import { useEffect, useState } from "react";
import { ZOOM_LEVELS, type ZoomLevel } from "../../lib/timeline-contract.js";
import { formatUtcTimestamp } from "../../lib/timeline-math.js";

interface TimelineControlsProps {
  canPlay: boolean;
  centerTimestamp: number;
  isPlaying: boolean;
  playbackRate: number;
  readLiveTimestamp: () => number;
  showDetections: boolean;
  showVocalizations: boolean;
  zoom: ZoomLevel;
  availableZooms: ZoomLevel[];
  onSkipBackward: () => void;
  onSkipForward: () => void;
  onTogglePlay: () => void;
  onCyclePlaybackRate: () => void;
  onSelectDetections: () => void;
  onSelectVocalizations: () => void;
  onZoomChange: (zoom: ZoomLevel) => void;
}

export function TimelineControls({
  canPlay,
  centerTimestamp,
  isPlaying,
  playbackRate,
  readLiveTimestamp,
  showDetections,
  showVocalizations,
  zoom,
  availableZooms,
  onSkipBackward,
  onSkipForward,
  onTogglePlay,
  onCyclePlaybackRate,
  onSelectDetections,
  onSelectVocalizations,
  onZoomChange,
}: TimelineControlsProps) {
  const [displayTimestamp, setDisplayTimestamp] = useState(centerTimestamp);

  useEffect(() => {
    if (!isPlaying) {
      setDisplayTimestamp(centerTimestamp);
      return;
    }

    let frameId = 0;
    const tick = () => {
      setDisplayTimestamp(readLiveTimestamp());
      frameId = window.requestAnimationFrame(tick);
    };

    tick();
    return () => window.cancelAnimationFrame(frameId);
  }, [centerTimestamp, isPlaying, readLiveTimestamp]);

  return (
    <div className="timeline-controls">
      <div className="timeline-controls__zoom-row">
        {ZOOM_LEVELS.filter((entry) => availableZooms.includes(entry)).map((entry) => (
          <button
            key={entry}
            type="button"
            className={`timeline-chip ${
              zoom === entry ? "timeline-chip--active" : ""
            }`}
            onClick={() => onZoomChange(entry)}
          >
            {entry}
          </button>
        ))}
      </div>

      <div className="timeline-controls__main-row">
        <div className="timeline-controls__transport">
          <button
            type="button"
            className="timeline-icon-button"
            onClick={onSkipBackward}
            disabled={!canPlay}
            aria-label="Skip backward"
          >
            {"<<"}
          </button>
          <button
            type="button"
            className="timeline-play-button"
            onClick={onTogglePlay}
            disabled={!canPlay}
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            className="timeline-icon-button"
            onClick={onSkipForward}
            disabled={!canPlay}
            aria-label="Skip forward"
          >
            {">>"}
          </button>
        </div>

        <div className="timeline-controls__status">
          <span className="timeline-status-pill timeline-status-pill--clock">
            {formatUtcTimestamp(displayTimestamp)}
          </span>
          <button
            type="button"
            className="timeline-status-pill timeline-status-pill--rate"
            onClick={onCyclePlaybackRate}
            disabled={!canPlay}
          >
            {playbackRate}x
          </button>
          <button
            type="button"
            className={`timeline-status-pill ${
              showDetections ? "timeline-status-pill--active" : ""
            }`}
            onClick={onSelectDetections}
          >
            Detections
          </button>
          <button
            type="button"
            className={`timeline-status-pill ${
              showVocalizations ? "timeline-status-pill--active" : ""
            }`}
            onClick={onSelectVocalizations}
          >
            Vocalizations
          </button>
          <span className="timeline-status-pill timeline-status-pill--range">
            Freq: 0-3 kHz
          </span>
        </div>
      </div>
    </div>
  );
}
