import { AudioLines, Pause, Play, SkipBack, SkipForward, Tag } from "lucide-react";
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
    <div className="timeline-controls" data-testid="timeline-controls">
      <div className="timeline-controls__zoom-row">
        {ZOOM_LEVELS.filter((entry) => availableZooms.includes(entry)).map((entry) => (
          <button
            key={entry}
            type="button"
            className={`timeline-zoom-chip ${
              zoom === entry ? "timeline-zoom-chip--active" : ""
            }`}
            onClick={() => onZoomChange(entry)}
          >
            {entry}
          </button>
        ))}
      </div>

      <div className="timeline-controls__main-row">
        <div className="timeline-controls__transport-rail">
          <span
            className="timeline-controls__timecode"
            data-testid="timeline-timecode"
          >
            {formatUtcTimestamp(displayTimestamp)}
          </span>
          <div className="timeline-controls__transport">
            <button
              type="button"
              className="timeline-transport-button"
              onClick={onSkipBackward}
              disabled={!canPlay}
              aria-label="Skip backward"
            >
              <SkipBack size={16} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              className="timeline-play-button"
              onClick={onTogglePlay}
              disabled={!canPlay}
              aria-label={isPlaying ? "Pause playback" : "Start playback"}
            >
              {isPlaying ? (
                <Pause size={16} strokeWidth={2} />
              ) : (
                <Play size={16} strokeWidth={2} className="timeline-play-button__icon" />
              )}
            </button>
            <button
              type="button"
              className="timeline-transport-button"
              onClick={onSkipForward}
              disabled={!canPlay}
              aria-label="Skip forward"
            >
              <SkipForward size={16} strokeWidth={1.8} />
            </button>
          </div>
          <button
            type="button"
            className="timeline-controls__rate-button"
            onClick={onCyclePlaybackRate}
            disabled={!canPlay}
            aria-label={`Playback rate ${playbackRate}x`}
          >
            {playbackRate}x
          </button>
        </div>

        <div className="timeline-controls__status">
          <button
            type="button"
            className={`timeline-controls__badge ${
              showDetections
                ? "timeline-controls__badge--detection-active"
                : ""
            }`}
            onClick={onSelectDetections}
            aria-pressed={showDetections}
          >
            <Tag size={12} strokeWidth={1.8} />
            Detections
          </button>
          <button
            type="button"
            className={`timeline-controls__badge ${
              showVocalizations
                ? "timeline-controls__badge--vocalization-active"
                : ""
            }`}
            onClick={onSelectVocalizations}
            aria-pressed={showVocalizations}
          >
            <AudioLines size={12} strokeWidth={1.8} />
            Vocalizations
          </button>
        </div>
      </div>
    </div>
  );
}
