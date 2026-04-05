import { useEffect, useRef, useState } from "react";
import {
  tilePath,
  tileTimeRange,
  type TimelineManifest,
  type ZoomLevel,
} from "../../lib/timeline-contract.js";
import {
  buildDetectionLanes,
  formatAxisTimestamp,
  getTimeTicks,
  getViewportRange,
  getVisibleDetections,
  getVisibleTileIndices,
  getVisibleVocalizationWindows,
  pixelToTimestamp,
  timeToPixel,
  type TimeRange,
} from "../../lib/timeline-math.js";
import { createDebugLogger } from "../../lib/debug-log.js";
import { timelineTileCache } from "../../lib/tile-cache.js";
import { ConfidenceStrip } from "./ConfidenceStrip.js";
import { DetectionOverlay } from "./DetectionOverlay.js";
import { VocalizationOverlay } from "./VocalizationOverlay.js";

interface TimelineViewportProps {
  centerTimestamp: number;
  manifest: TimelineManifest;
  showDetections: boolean;
  showVocalizations: boolean;
  zoom: ZoomLevel;
  onCenterTimestampCommit: (timestamp: number) => void;
  onCenterTimestampPreview: (timestamp: number) => void;
}

interface DragState {
  pointerId: number;
  startX: number;
  startCenterTimestamp: number;
}

const DRAG_THRESHOLD_PX = 4;
const viewportDebug = createDebugLogger("timeline:viewport");

export function TimelineViewport({
  centerTimestamp,
  manifest,
  showDetections,
  showVocalizations,
  zoom,
  onCenterTimestampCommit,
  onCenterTimestampPreview,
}: TimelineViewportProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragExceededThresholdRef = useRef(false);
  const suppressNextClickRef = useRef(false);
  const [width, setWidth] = useState(0);
  const [dragState, setDragState] = useState<DragState | null>(null);

  useEffect(() => {
    const element = trackRef.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const nextWidth = Math.floor(entries[0]?.contentRect.width ?? 0);
      setWidth(nextWidth);
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const range = getViewportRange(manifest, zoom, centerTimestamp);
  const visibleTileIndices = getVisibleTileIndices(manifest, zoom, range, 2);
  const visibleDetections = getVisibleDetections(manifest.detections, range);
  const detectionLanes = buildDetectionLanes(visibleDetections);
  const vocalizationWindows = getVisibleVocalizationWindows(
    manifest.vocalization_labels,
    range,
  );
  const timeTicks = getTimeTicks(range, zoom);
  const spectrogramHeight = width < 700 ? 248 : 336;

  useEffect(() => {
    visibleTileIndices.forEach((index) => {
      void timelineTileCache.load(tilePath(manifest.job.id, zoom, index)).catch(() => {
        // Broken tile URLs still leave the rest of the viewport usable.
      });
    });
  }, [manifest.job.id, visibleTileIndices, zoom]);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>): void {
    const element = trackRef.current;
    if (!element || width <= 0) {
      return;
    }

    element.setPointerCapture(event.pointerId);
    dragExceededThresholdRef.current = false;
    suppressNextClickRef.current = false;
    setDragState({
      pointerId: event.pointerId,
      startX: event.clientX,
      startCenterTimestamp: centerTimestamp,
    });
    viewportDebug("drag-start", {
      centerTimestamp,
      pointerId: event.pointerId,
      width,
      zoom,
    });
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    if (!dragState || dragState.pointerId !== event.pointerId || width <= 0) {
      return;
    }

    const deltaX = event.clientX - dragState.startX;
    if (Math.abs(deltaX) >= DRAG_THRESHOLD_PX) {
      dragExceededThresholdRef.current = true;
    }

    const deltaSeconds = (-deltaX / width) * range.span;
    onCenterTimestampPreview(dragState.startCenterTimestamp + deltaSeconds);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>): void {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (dragExceededThresholdRef.current) {
      const deltaX = event.clientX - dragState.startX;
      const deltaSeconds = (-deltaX / width) * range.span;
      viewportDebug("drag-commit", {
        committedTimestamp: dragState.startCenterTimestamp + deltaSeconds,
        deltaSeconds,
        deltaX,
        pointerId: event.pointerId,
        startCenterTimestamp: dragState.startCenterTimestamp,
        width,
        zoom,
      });
      onCenterTimestampCommit(dragState.startCenterTimestamp + deltaSeconds);
      suppressNextClickRef.current = true;
    }

    dragExceededThresholdRef.current = false;
    setDragState(null);
    trackRef.current?.releasePointerCapture(event.pointerId);
  }

  function handleClick(event: React.MouseEvent<HTMLDivElement>): void {
    if (width <= 0 || dragState) {
      return;
    }

    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    viewportDebug("click-commit", {
      committedTimestamp: pixelToTimestamp(x, range, width),
      clickOffsetX: x,
      width,
      zoom,
    });
    onCenterTimestampCommit(pixelToTimestamp(x, range, width));
  }

  return (
    <section className="timeline-stage">
      <div className="timeline-stage__y-axis">
        <span>3.0k</span>
        <span>2.0k</span>
        <span>1.0k</span>
        <span>0</span>
        <span>Hz</span>
      </div>

      <div className="timeline-stage__content">
        <div
          ref={trackRef}
          className={`timeline-track ${dragState ? "timeline-track--dragging" : ""}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={handleClick}
          role="presentation"
        >
          <SpectrogramTiles
            height={spectrogramHeight}
            manifest={manifest}
            range={range}
            tileIndices={visibleTileIndices}
            width={width}
            zoom={zoom}
          />

          {showDetections ? (
            <DetectionOverlay lanes={detectionLanes} range={range} width={width} />
          ) : null}

          {showVocalizations ? (
            <VocalizationOverlay
              range={range}
              types={manifest.vocalization_types}
              width={width}
              windows={vocalizationWindows}
            />
          ) : null}

          <div className="timeline-playhead" aria-hidden="true">
            <span className="timeline-playhead__marker" />
          </div>
        </div>

        <ConfidenceStrip
          confidence={manifest.confidence}
          range={range}
          startTimestamp={manifest.job.start_timestamp}
          width={width}
        />

        <TimeAxis range={range} ticks={timeTicks} width={width} zoom={zoom} />
      </div>
    </section>
  );
}

interface SpectrogramTilesProps {
  height: number;
  manifest: TimelineManifest;
  range: TimeRange;
  tileIndices: number[];
  width: number;
  zoom: ZoomLevel;
}

function SpectrogramTiles({
  height,
  manifest,
  range,
  tileIndices,
  width,
  zoom,
}: SpectrogramTilesProps) {
  return (
    <div className="timeline-spectrogram" style={{ height: `${height}px` }}>
      <div className="timeline-spectrogram__grid" aria-hidden="true" />
      {tileIndices.map((index) => {
        const tileRange = tileTimeRange(manifest, zoom, index);
        const left = timeToPixel(tileRange.start, range, width);
        const right = timeToPixel(tileRange.end, range, width);

        return (
          <img
            key={`${zoom}:${index}`}
            src={tilePath(manifest.job.id, zoom, index)}
            alt=""
            className="timeline-spectrogram__tile"
            draggable={false}
            style={{
              left: `${left}px`,
              width: `${Math.max(2, right - left)}px`,
            }}
          />
        );
      })}
    </div>
  );
}

interface TimeAxisProps {
  range: TimeRange;
  ticks: number[];
  width: number;
  zoom: ZoomLevel;
}

function TimeAxis({ range, ticks, width, zoom }: TimeAxisProps) {
  return (
    <div className="timeline-axis">
      {ticks.map((tick) => (
        <span
          key={tick}
          className="timeline-axis__tick"
          style={{ left: `${timeToPixel(tick, range, width)}px` }}
        >
          {formatAxisTimestamp(tick, zoom)}
        </span>
      ))}
    </div>
  );
}
