import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  tilePath,
  tileTimeRange,
  type Detection,
  type TimelineManifest,
  type ZoomLevel,
} from "../../lib/timeline-contract.js";
import {
  buildDetectionLanes,
  buildVocalizationLanes,
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
import { drawTimelineCanvas } from "../../lib/timeline-canvas-renderer.js";
import { createDebugLogger } from "../../lib/debug-log.js";
import {
  buildDetectionDrawRects,
  buildVocalizationDrawWindows,
  findVocalizationWindowAtPoint,
  type DetectionDrawRect,
  type VocalizationDrawWindow,
  findDetectionRectAtPoint,
} from "../../lib/timeline-overlay-geometry.js";
import { timelineTileCache } from "../../lib/tile-cache.js";
import { ConfidenceStrip } from "./ConfidenceStrip.js";

interface TimelineViewportProps {
  centerTimestamp: number;
  enableOverlayHover?: boolean;
  isPlaying: boolean;
  manifest: TimelineManifest;
  onInteractionChange?: (isInteracting: boolean) => void;
  showDetections: boolean;
  showVocalizations: boolean;
  zoom: ZoomLevel;
  onCenterTimestampCommit: (timestamp: number) => void;
  onCenterTimestampPreview: (timestamp: number) => void;
  readLiveTimestamp: () => number;
}

interface DragState {
  pointerId: number;
  startX: number;
  startCenterTimestamp: number;
}

interface HoverAnchor {
  x: number;
  y: number;
}

interface HoverTooltipSize {
  height: number;
  width: number;
}

interface HoverTooltipPositionInput {
  anchorX: number;
  anchorY: number;
  margin?: number;
  offsetX?: number;
  offsetY?: number;
  tooltipHeight: number;
  tooltipWidth: number;
  trackHeight: number;
  trackWidth: number;
}

interface TimelineHoverRow {
  key: string;
  source?: "manual" | "inference";
  text: string;
  textColor?: string;
  variant: "plain" | "vocalization";
}

type TimelineHoverCard =
  {
    anchor: HoverAnchor;
    key: string;
    rows: TimelineHoverRow[];
  };

const DRAG_THRESHOLD_PX = 4;
const TRACK_HEIGHT_DESKTOP = 448;
const TRACK_HEIGHT_MOBILE = 331;
const TOOLTIP_MARGIN_PX = 12;
const TOOLTIP_OFFSET_X = 12;
const TOOLTIP_OFFSET_Y = 12;
const DEFAULT_TOOLTIP_SIZE: HoverTooltipSize = {
  height: 80,
  width: 220,
};
const viewportDebug = createDebugLogger("timeline:viewport");

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function formatConfidencePercentage(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function formatDetectionHoverText(
  detection: Pick<Detection, "avg_confidence">,
): string {
  return `Detection: ${formatConfidencePercentage(detection.avg_confidence)}`;
}

export function formatVocalizationHoverText(
  row: Pick<TimelineHoverRow, "text"> & { confidence: number },
): string {
  return `${row.text}: ${formatConfidencePercentage(row.confidence)}`;
}

export function getHoverTooltipPosition({
  anchorX,
  anchorY,
  margin = TOOLTIP_MARGIN_PX,
  offsetX = TOOLTIP_OFFSET_X,
  offsetY = TOOLTIP_OFFSET_Y,
  tooltipHeight,
  tooltipWidth,
  trackHeight,
  trackWidth,
}: HoverTooltipPositionInput): HoverAnchor {
  const maxLeft = Math.max(margin, trackWidth - tooltipWidth - margin);
  const desiredLeft = anchorX + offsetX;
  const left = clamp(desiredLeft, margin, maxLeft);

  const desiredTop = anchorY + offsetY;
  const flippedTop = anchorY - tooltipHeight - offsetY;
  const shouldFlipUp = desiredTop + tooltipHeight > trackHeight - margin;
  const maxTop = Math.max(margin, trackHeight - tooltipHeight - margin);
  const top = clamp(shouldFlipUp ? flippedTop : desiredTop, margin, maxTop);

  return { x: left, y: top };
}

function buildDetectionHoverCard(
  rect: DetectionDrawRect,
  anchor: HoverAnchor,
): TimelineHoverCard {
  return {
    anchor,
    key: rect.detection.row_id,
    rows: [
      {
        key: rect.detection.row_id,
        text: formatDetectionHoverText(rect.detection),
        variant: "plain",
      },
    ],
  };
}

function buildVocalizationHoverCard(
  window: VocalizationDrawWindow,
  anchor: HoverAnchor,
): TimelineHoverCard {
  return {
    anchor,
    key: window.key,
    rows: window.hoverRows.map((row) => ({
      key: row.key,
      source: row.source,
      text: formatVocalizationHoverText(row),
      textColor: row.textColor,
      variant: "vocalization",
    })),
  };
}

export function TimelineViewport({
  centerTimestamp,
  enableOverlayHover = true,
  isPlaying,
  manifest,
  onInteractionChange,
  showDetections,
  showVocalizations,
  zoom,
  onCenterTimestampCommit,
  onCenterTimestampPreview,
  readLiveTimestamp,
}: TimelineViewportProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragExceededThresholdRef = useRef(false);
  const suppressNextClickRef = useRef(false);
  const displayCenterTimestampRef = useRef(centerTimestamp);
  const detectionRectsRef = useRef<ReturnType<typeof buildDetectionDrawRects>>([]);
  const vocalizationWindowsRef =
    useRef<ReturnType<typeof buildVocalizationDrawWindows>>([]);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [displayCenterTimestamp, setDisplayCenterTimestamp] = useState(centerTimestamp);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoveredCard, setHoveredCard] = useState<TimelineHoverCard | null>(null);
  const [tooltipSize, setTooltipSize] =
    useState<HoverTooltipSize>(DEFAULT_TOOLTIP_SIZE);
  const [tileLoadVersion, setTileLoadVersion] = useState(0);

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

  useEffect(() => {
    displayCenterTimestampRef.current = displayCenterTimestamp;
  }, [displayCenterTimestamp]);

  useEffect(() => {
    if (dragState) {
      return;
    }

    if (!isPlaying) {
      setDisplayCenterTimestamp(centerTimestamp);
      return;
    }

    let frameId = 0;
    const tick = () => {
      const nextTimestamp = readLiveTimestamp();
      setDisplayCenterTimestamp((current) =>
        Math.abs(current - nextTimestamp) > 0.0005 ? nextTimestamp : current,
      );
      frameId = window.requestAnimationFrame(tick);
    };

    tick();
    return () => window.cancelAnimationFrame(frameId);
  }, [centerTimestamp, dragState, isPlaying, readLiveTimestamp]);

  useEffect(() => () => onInteractionChange?.(false), [onInteractionChange]);

  const range = getViewportRange(manifest, zoom, displayCenterTimestamp);
  const visibleTileIndices = getVisibleTileIndices(manifest, zoom, range, 2);
  const visibleDetections = getVisibleDetections(manifest.detections, range);
  const detectionLanes = buildDetectionLanes(visibleDetections);
  const visibleVocalizationWindows = getVisibleVocalizationWindows(
    manifest.vocalization_labels,
    range,
  );
  const trackHeight = width < 700 ? TRACK_HEIGHT_MOBILE : TRACK_HEIGHT_DESKTOP;
  const detectionRects = showDetections
    ? buildDetectionDrawRects(
        detectionLanes,
        range,
        width,
        trackHeight,
        zoom,
        manifest.confidence.window_sec,
      )
    : [];
  const vocalizationLanes = buildVocalizationLanes(visibleVocalizationWindows);
  const vocalizationDrawWindows = showVocalizations
    ? buildVocalizationDrawWindows(
        vocalizationLanes,
        range,
        width,
        manifest.vocalization_types,
        trackHeight,
        zoom,
        manifest.confidence.window_sec,
      )
    : [];
  const timeTicks = getTimeTicks(range, zoom);
  const visibleTileIndicesKey = visibleTileIndices.join(",");
  const hoverMode =
    !enableOverlayHover
      ? "none"
      : showDetections
        ? "detection"
        : showVocalizations
          ? "vocalization"
          : "none";
  const hoveredCardPosition =
    hoveredCard == null
      ? null
      : getHoverTooltipPosition({
          anchorX: hoveredCard.anchor.x,
          anchorY: hoveredCard.anchor.y,
          tooltipHeight: tooltipSize.height,
          tooltipWidth: tooltipSize.width,
          trackHeight,
          trackWidth: width,
        });

  useEffect(() => {
    setHoveredCard(null);
  }, [hoverMode]);

  useEffect(() => {
    let cancelled = false;

    visibleTileIndices.forEach((index) => {
      void timelineTileCache
        .load(tilePath(manifest.job.id, zoom, index))
        .then(() => {
          if (!cancelled) {
            setTileLoadVersion((current) => current + 1);
          }
        })
        .catch(() => {
          // Broken tile URLs still leave the rest of the viewport usable.
        });
    });

    return () => {
      cancelled = true;
    };
  }, [manifest.job.id, visibleTileIndicesKey, zoom]);

  useEffect(() => {
    detectionRectsRef.current = detectionRects;
  }, [detectionRects]);

  useEffect(() => {
    vocalizationWindowsRef.current = vocalizationDrawWindows;
  }, [vocalizationDrawWindows]);

  useLayoutEffect(() => {
    if (!hoveredCard) {
      return;
    }

    const element = tooltipRef.current;
    if (!element) {
      return;
    }

    const nextSize = {
      height: Math.ceil(element.offsetHeight),
      width: Math.ceil(element.offsetWidth),
    };

    if (nextSize.height <= 0 || nextSize.width <= 0) {
      return;
    }

    setTooltipSize((current) =>
      current.width === nextSize.width && current.height === nextSize.height
        ? current
        : nextSize,
    );
  }, [hoveredCard, trackHeight, width]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * pixelRatio);
    canvas.height = Math.floor(trackHeight * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${trackHeight}px`;

    drawTimelineCanvas(context, {
      detectionRects,
      height: trackHeight,
      pixelRatio,
      tileItems: visibleTileIndices.map((index) => {
        const currentTilePath = tilePath(manifest.job.id, zoom, index);
        const tileRange = tileTimeRange(manifest, zoom, index);
        const left = timeToPixel(tileRange.start, range, width);
        const right = timeToPixel(tileRange.end, range, width);

        return {
          image: timelineTileCache.peek(currentTilePath),
          width: Math.max(2, right - left),
          x: left,
        };
      }),
      vocalizationWindows: vocalizationDrawWindows,
      width,
    });
  }, [
    detectionRects,
    manifest,
    range,
    tileLoadVersion,
    trackHeight,
    visibleTileIndices,
    vocalizationDrawWindows,
    width,
    zoom,
  ]);

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
      startCenterTimestamp: displayCenterTimestampRef.current,
    });
    setHoveredCard(null);
    onInteractionChange?.(true);
    viewportDebug("drag-start", {
      centerTimestamp: displayCenterTimestampRef.current,
      pointerId: event.pointerId,
      width,
      zoom,
    });
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    if (width <= 0) {
      return;
    }

    if (dragState && dragState.pointerId === event.pointerId) {
      const deltaX = event.clientX - dragState.startX;
      if (Math.abs(deltaX) >= DRAG_THRESHOLD_PX) {
        dragExceededThresholdRef.current = true;
      }

      const previewTimestamp = pixelToTimestamp(
        width / 2 - deltaX,
        getViewportRange(manifest, zoom, dragState.startCenterTimestamp),
        width,
      );
      const nextTimestamp = Math.min(
        manifest.job.end_timestamp,
        Math.max(manifest.job.start_timestamp, previewTimestamp),
      );

      setDisplayCenterTimestamp(nextTimestamp);
      onCenterTimestampPreview(nextTimestamp);
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const anchor = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };

    if (hoverMode === "detection") {
      const nextHovered = findDetectionRectAtPoint(
        detectionRectsRef.current,
        anchor.x,
        anchor.y,
      );
      setHoveredCard(nextHovered ? buildDetectionHoverCard(nextHovered, anchor) : null);
      return;
    }

    if (hoverMode === "vocalization") {
      const nextHovered = findVocalizationWindowAtPoint(
        vocalizationWindowsRef.current,
        anchor.x,
        anchor.y,
      );
      setHoveredCard(
        nextHovered ? buildVocalizationHoverCard(nextHovered, anchor) : null,
      );
      return;
    }

    setHoveredCard(null);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>): void {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (dragExceededThresholdRef.current) {
      const deltaX = event.clientX - dragState.startX;
      const previewTimestamp = pixelToTimestamp(
        width / 2 - deltaX,
        getViewportRange(manifest, zoom, dragState.startCenterTimestamp),
        width,
      );
      const committedTimestamp = Math.min(
        manifest.job.end_timestamp,
        Math.max(manifest.job.start_timestamp, previewTimestamp),
      );
      viewportDebug("drag-commit", {
        committedTimestamp,
        deltaX,
        pointerId: event.pointerId,
        startCenterTimestamp: dragState.startCenterTimestamp,
        width,
        zoom,
      });
      onCenterTimestampCommit(committedTimestamp);
      suppressNextClickRef.current = true;
    }

    dragExceededThresholdRef.current = false;
    setDragState(null);
    onInteractionChange?.(false);
    trackRef.current?.releasePointerCapture(event.pointerId);
  }

  function handlePointerLeave(): void {
    if (!dragState) {
      setHoveredCard(null);
    }
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
          style={{ height: `${trackHeight}px`, minHeight: `${trackHeight}px` }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onClick={handleClick}
          role="presentation"
        >
          <canvas ref={canvasRef} className="timeline-track__canvas" aria-hidden="true" />

          <div className="timeline-playhead" aria-hidden="true">
            <span className="timeline-playhead__marker" />
          </div>

          {hoveredCard && hoveredCardPosition ? (
            <div
              ref={tooltipRef}
              className="timeline-tooltip"
              style={{
                left: `${hoveredCardPosition.x}px`,
                top: `${hoveredCardPosition.y}px`,
              }}
            >
              {hoveredCard.rows.map((row) =>
                row.variant === "vocalization" ? (
                  <span
                    key={row.key}
                    className={`timeline-tooltip__tag ${row.source === "inference" ? "timeline-tooltip__tag--inference" : ""}`}
                    style={{
                      color: row.textColor,
                    }}
                  >
                    {row.text}
                  </span>
                ) : (
                  <span key={row.key} className="timeline-tooltip__row">
                    {row.text}
                  </span>
                ),
              )}
            </div>
          ) : null}
        </div>

        {showDetections ? (
          <ConfidenceStrip
            confidence={manifest.confidence}
            range={range}
            startTimestamp={manifest.job.start_timestamp}
            width={width}
          />
        ) : (
          <div
            className="timeline-confidence-strip timeline-confidence-strip--placeholder"
            aria-hidden="true"
          />
        )}

        <TimeAxis range={range} ticks={timeTicks} width={width} zoom={zoom} />
      </div>
    </section>
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
