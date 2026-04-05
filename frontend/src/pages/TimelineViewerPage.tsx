import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchTimelineManifest } from "../api/timeline.js";
import { TimelineControls } from "../components/timeline/TimelineControls.js";
import { TimelineLayout } from "../components/timeline/TimelineLayout.js";
import { TimelineViewport } from "../components/timeline/TimelineViewport.js";
import { useTimelinePlayback } from "../hooks/useTimelinePlayback.js";
import {
  availableZoomLevels,
  defaultZoomForDuration,
  manifestDuration,
  type TimelineManifest,
  type ZoomLevel,
} from "../lib/timeline-contract.js";
import {
  clampTimestamp,
  formatSpeciesLabel,
  formatTimelineSpan,
  getPanStepSeconds,
} from "../lib/timeline-math.js";

export function TimelineViewerPage() {
  const { jobId = "" } = useParams();
  const [manifest, setManifest] = useState<TimelineManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<ZoomLevel>("1m");
  const [centerTimestamp, setCenterTimestamp] = useState(0);
  const [showDetections, setShowDetections] = useState(true);
  const [showVocalizations, setShowVocalizations] = useState(true);

  const playback = useTimelinePlayback(manifest);

  useEffect(() => {
    if (!jobId) {
      return;
    }

    setLoading(true);
    setError(null);

    fetchTimelineManifest(jobId)
      .then((response) => {
        setManifest(response);
        const duration = manifestDuration(response);
        const nextZoom = defaultZoomForDuration(duration);
        const availableZooms = availableZoomLevels(response);
        const initialZoom = availableZooms.includes(nextZoom)
          ? nextZoom
          : availableZooms[availableZooms.length - 1] ?? "1m";
        const initialCenter = response.job.start_timestamp;

        setZoom(initialZoom);
        setCenterTimestamp(initialCenter);
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : `Failed to load timeline ${jobId}.`,
        ),
      )
      .finally(() => setLoading(false));
  }, [jobId]);

  useEffect(() => {
    if (!manifest) {
      return;
    }

    if (
      playback.isPlaying ||
      Math.abs(playback.currentTimestamp - centerTimestamp) > 0.001
    ) {
      setCenterTimestamp(playback.currentTimestamp);
    }
  }, [centerTimestamp, manifest, playback.currentTimestamp, playback.isPlaying]);

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
        void playback.togglePlay();
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
        void handleSeek(centerTimestamp - getPanStepSeconds(zoom));
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        void handleSeek(centerTimestamp + getPanStepSeconds(zoom));
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
    setCenterTimestamp(nextTimestamp);
    await playback.seek(nextTimestamp, { autoplay: playback.isPlaying });
  }

  function handlePreview(timestamp: number): void {
    if (!manifest) {
      return;
    }

    setCenterTimestamp(clampTimestamp(manifest, timestamp));
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
      <div className="timeline-viewer">
        <header className="timeline-viewer__header">
          <div className="timeline-viewer__header-left">
            <Link to="/" className="timeline-back-link">
              Back to jobs
            </Link>
            <div>
              <h1>{manifest.job.hydrophone_name}</h1>
              <p>
                {formatSpeciesLabel(manifest.job.species)} / {manifest.job.model_name}{" "}
                {manifest.job.model_version}
              </p>
            </div>
          </div>
          <div className="timeline-viewer__header-right">
            <span>{formatTimelineSpan(manifest.job.start_timestamp, manifest.job.end_timestamp)}</span>
            <span>Window selection: {manifest.job.window_selection}</span>
          </div>
        </header>

        <TimelineViewport
          centerTimestamp={centerTimestamp}
          manifest={manifest}
          showDetections={showDetections}
          showVocalizations={showVocalizations}
          zoom={zoom}
          onCenterTimestampCommit={(timestamp) => {
            void handleSeek(timestamp);
          }}
          onCenterTimestampPreview={handlePreview}
        />

        <TimelineControls
          availableZooms={zooms}
          canPlay={playback.canPlay}
          centerTimestamp={centerTimestamp}
          isPlaying={playback.isPlaying}
          playbackRate={playback.playbackRate}
          showDetections={showDetections}
          showVocalizations={showVocalizations}
          zoom={zoom}
          onCyclePlaybackRate={playback.cyclePlaybackRate}
          onSkipBackward={() => {
            void handleSeek(centerTimestamp - getPanStepSeconds(zoom));
          }}
          onSkipForward={() => {
            void handleSeek(centerTimestamp + getPanStepSeconds(zoom));
          }}
          onToggleDetections={() => setShowDetections((current) => !current)}
          onTogglePlay={() => {
            void playback.togglePlay();
          }}
          onToggleVocalizations={() => setShowVocalizations((current) => !current)}
          onZoomChange={setZoom}
        />

        <audio ref={playback.primaryAudioRef} className="timeline-hidden-audio" />
        <audio ref={playback.secondaryAudioRef} className="timeline-hidden-audio" />
      </div>
    </TimelineLayout>
  );
}
