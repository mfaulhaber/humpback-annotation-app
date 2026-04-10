import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { fetchTimelineIndex, fetchTimelineManifest } from "../api/timeline.js";
import { TimelineControls } from "../components/timeline/TimelineControls.js";
import { TimelineLayout } from "../components/timeline/TimelineLayout.js";
import { TimelineViewport } from "../components/timeline/TimelineViewport.js";
import { useTimelinePlayback } from "../hooks/useTimelinePlayback.js";
import {
  availableZoomLevels,
  findTimelineEntry,
  type TimelineManifest,
  type ZoomLevel,
} from "../lib/timeline-contract.js";
import {
  clampTimestamp,
  formatTimelineSpan,
  getPanStepSeconds,
} from "../lib/timeline-math.js";
import { createDebugLogger } from "../lib/debug-log.js";
import {
  getOverlayVisibility,
  mergeTimelineViewDefaults,
  parseTimelineViewSearchParams,
  resolveInitialTimelineViewState,
  type TimelineOverlayMode,
  shouldSyncCenterTimestampFromPlayback,
  toggleOverlayMode,
} from "../lib/timeline-viewer-state.js";

const viewerDebug = createDebugLogger("timeline:viewer");

export function TimelineViewerPage() {
  const { jobId = "" } = useParams();
  const location = useLocation();
  const [manifest, setManifest] = useState<TimelineManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<ZoomLevel>("1m");
  const [centerTimestamp, setCenterTimestamp] = useState(0);
  const [overlayMode, setOverlayMode] =
    useState<TimelineOverlayMode>("detections");
  const [isViewportInteracting, setIsViewportInteracting] = useState(false);

  const playback = useTimelinePlayback(manifest);
  const {
    showDetections: isDetectionMode,
    showVocalizations,
  } =
    getOverlayVisibility(overlayMode);

  useEffect(() => {
    if (!jobId) {
      return;
    }

    let cancelled = false;
    const queryDefaults = parseTimelineViewSearchParams(
      new URLSearchParams(location.search),
    );

    async function loadTimeline(): Promise<void> {
      setLoading(true);
      setError(null);

      try {
        const [manifestResult, indexResult] = await Promise.allSettled([
          fetchTimelineManifest(jobId),
          fetchTimelineIndex(),
        ]);

        if (cancelled) {
          return;
        }

        if (manifestResult.status === "rejected") {
          throw manifestResult.reason;
        }

        if (indexResult.status === "rejected") {
          viewerDebug("index-defaults-unavailable", {
            jobId,
            reason:
              indexResult.reason instanceof Error
                ? indexResult.reason.message
                : String(indexResult.reason),
          });
        }

        const timelineEntry =
          indexResult.status === "fulfilled"
            ? findTimelineEntry(indexResult.value, jobId)
            : undefined;
        const initialDefaults = mergeTimelineViewDefaults(
          timelineEntry,
          queryDefaults,
        );
        const initialState = resolveInitialTimelineViewState(
          manifestResult.value,
          initialDefaults,
        );

        setManifest(manifestResult.value);
        setZoom(initialState.zoom);
        setCenterTimestamp(initialState.centerTimestamp);
        setOverlayMode(initialState.overlayMode);
        setIsViewportInteracting(false);
        viewerDebug("manifest-loaded", {
          jobId: manifestResult.value.job.id,
          initialCenterTimestamp: initialState.centerTimestamp,
          initialOverlayMode: initialState.overlayMode,
          initialZoom: initialState.zoom,
          usedIndexDefaults:
            timelineEntry?.starting_pos !== undefined ||
            timelineEntry?.view_mode !== undefined ||
            timelineEntry?.zoom_level !== undefined,
          usedQueryDefaults:
            queryDefaults.starting_pos !== undefined ||
            queryDefaults.view_mode !== undefined ||
            queryDefaults.zoom_level !== undefined,
        });
      } catch (reason: unknown) {
        if (cancelled) {
          return;
        }

        setError(
          reason instanceof Error
            ? reason.message
            : `Failed to load timeline ${jobId}.`,
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadTimeline();

    return () => {
      cancelled = true;
    };
  }, [jobId, location.search]);

  useEffect(() => {
    if (!manifest) {
      return;
    }

    const shouldSync = shouldSyncCenterTimestampFromPlayback(
      centerTimestamp,
      playback.currentTimestamp,
      playback.isPlaying,
      isViewportInteracting,
    );

    viewerDebug("sync-snapshot", {
      centerTimestamp,
      isPlaying: playback.isPlaying,
      playbackTimestamp: playback.currentTimestamp,
      shouldSync,
      zoom,
    });

    if (shouldSync) {
      viewerDebug("center-sync-from-playback", {
        centerTimestamp,
        playbackTimestamp: playback.currentTimestamp,
        zoom,
      });
      setCenterTimestamp(playback.currentTimestamp);
    }
  }, [
    centerTimestamp,
    isViewportInteracting,
    manifest,
    playback.currentTimestamp,
    playback.isPlaying,
    zoom,
  ]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!manifest) {
        return;
      }

      if (
        event.target instanceof HTMLElement &&
        (event.target.tagName === "INPUT" ||
          event.target.tagName === "TEXTAREA" ||
          event.target.isContentEditable)
      ) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        const interactionTimestamp = playback.isPlaying
          ? playback.readLiveTimestamp()
          : centerTimestamp;
        viewerDebug("toggle-play", {
          source: "keyboard",
          centerTimestamp: interactionTimestamp,
          isPlaying: playback.isPlaying,
          playbackTimestamp: playback.currentTimestamp,
        });
        void playback.togglePlay(interactionTimestamp);
        return;
      }

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        const zooms = availableZoomLevels(manifest);
        const index = zooms.indexOf(zoom);
        if (index < zooms.length - 1) {
          setZoom(zooms[index + 1]!);
        }
        return;
      }

      if (event.key === "-") {
        event.preventDefault();
        const zooms = availableZoomLevels(manifest);
        const index = zooms.indexOf(zoom);
        if (index > 0) {
          setZoom(zooms[index - 1]!);
        }
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        const baseTimestamp = playback.isPlaying
          ? playback.readLiveTimestamp()
          : centerTimestamp;
        void handleSeek(baseTimestamp - getPanStepSeconds(zoom));
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        const baseTimestamp = playback.isPlaying
          ? playback.readLiveTimestamp()
          : centerTimestamp;
        void handleSeek(baseTimestamp + getPanStepSeconds(zoom));
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [manifest, zoom, centerTimestamp, playback]);

  async function handleSeek(timestamp: number): Promise<void> {
    if (!manifest) {
      return;
    }

    const nextTimestamp = clampTimestamp(manifest, timestamp);
    viewerDebug("seek-request", {
      requestedTimestamp: timestamp,
      nextTimestamp,
      isPlaying: playback.isPlaying,
      playbackTimestamp: playback.currentTimestamp,
    });
    setCenterTimestamp(nextTimestamp);
    await playback.seek(nextTimestamp, { autoplay: playback.isPlaying });
  }

  function handlePreview(timestamp: number): void {
    if (!manifest) {
      return;
    }

    const nextTimestamp = clampTimestamp(manifest, timestamp);
    viewerDebug("seek-preview", {
      previewTimestamp: nextTimestamp,
      requestedTimestamp: timestamp,
    });
    setCenterTimestamp(nextTimestamp);
  }

  if (loading) {
    return (
      <TimelineLayout chrome="viewer">
        <div className="timeline-loading-state">
          <h1>Loading timeline</h1>
          <p>Fetching `data/{jobId}/manifest.json`...</p>
        </div>
      </TimelineLayout>
    );
  }

  if (error || !manifest) {
    return (
      <TimelineLayout chrome="viewer">
        <div className="timeline-loading-state timeline-loading-state--error">
          <h1>Timeline unavailable</h1>
          <p>{error ?? `Timeline ${jobId} could not be loaded.`}</p>
          <Link to="/" className="timeline-inline-link">
            Back to all jobs
          </Link>
        </div>
      </TimelineLayout>
    );
  }

  const zooms = availableZoomLevels(manifest);

  return (
    <TimelineLayout chrome="viewer">
      <div className="timeline-viewer" data-testid="timeline-viewer">
        <header
          className="timeline-viewer__header"
          data-testid="timeline-viewer-header"
        >
          <Link to="/" className="timeline-back-link">
            Back to jobs
          </Link>
          <div className="timeline-viewer__meta-row">
            <span className="timeline-viewer__meta-item">
              <span className="timeline-viewer__meta-label">Hydrophone:</span>
              {manifest.job.hydrophone_name}
            </span>
            <span className="timeline-viewer__meta-item">
              <span className="timeline-viewer__meta-label">Model:</span>
              {[manifest.job.model_name, manifest.job.model_version]
                .filter(Boolean)
                .join(" ")}
            </span>
            <span className="timeline-viewer__meta-item">
              <span className="timeline-viewer__meta-label">Date Range:</span>
              {formatTimelineSpan(manifest.job.start_timestamp, manifest.job.end_timestamp)}
            </span>
          </div>
        </header>

        <TimelineViewport
          centerTimestamp={centerTimestamp}
          enableOverlayHover={isDetectionMode || showVocalizations}
          isPlaying={playback.isPlaying}
          manifest={manifest}
          onInteractionChange={setIsViewportInteracting}
          showDetections={isDetectionMode}
          showVocalizations={showVocalizations}
          zoom={zoom}
          onCenterTimestampCommit={(timestamp) => {
            void handleSeek(timestamp);
          }}
          onCenterTimestampPreview={handlePreview}
          readLiveTimestamp={playback.readLiveTimestamp}
        />

        <TimelineControls
          availableZooms={zooms}
          canPlay={playback.canPlay}
          centerTimestamp={centerTimestamp}
          isPlaying={playback.isPlaying}
          playbackRate={playback.playbackRate}
          readLiveTimestamp={playback.readLiveTimestamp}
          showDetections={isDetectionMode}
          showVocalizations={showVocalizations}
          zoom={zoom}
          onCyclePlaybackRate={playback.cyclePlaybackRate}
          onSkipBackward={() => {
            const baseTimestamp = playback.isPlaying
              ? playback.readLiveTimestamp()
              : centerTimestamp;
            void handleSeek(baseTimestamp - getPanStepSeconds(zoom));
          }}
          onSkipForward={() => {
            const baseTimestamp = playback.isPlaying
              ? playback.readLiveTimestamp()
              : centerTimestamp;
            void handleSeek(baseTimestamp + getPanStepSeconds(zoom));
          }}
          onSelectDetections={() =>
            setOverlayMode((current) =>
              toggleOverlayMode(current, "detections"),
            )
          }
          onTogglePlay={() => {
            const interactionTimestamp = playback.isPlaying
              ? playback.readLiveTimestamp()
              : centerTimestamp;
            viewerDebug("toggle-play", {
              source: "button",
              centerTimestamp: interactionTimestamp,
              isPlaying: playback.isPlaying,
              playbackTimestamp: playback.currentTimestamp,
            });
            void playback.togglePlay(interactionTimestamp);
          }}
          onSelectVocalizations={() =>
            setOverlayMode((current) =>
              toggleOverlayMode(current, "vocalizations"),
            )
          }
          onZoomChange={setZoom}
        />

        <audio ref={playback.primaryAudioRef} className="timeline-hidden-audio" />
        <audio ref={playback.secondaryAudioRef} className="timeline-hidden-audio" />
      </div>
    </TimelineLayout>
  );
}
