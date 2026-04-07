const PLAYBACK_SYNC_EPSILON = 0.001;

export type TimelineOverlayMode = "none" | "detections" | "vocalizations";

export function shouldSyncCenterTimestampFromPlayback(
  centerTimestamp: number,
  playbackTimestamp: number,
  isPlaying: boolean,
  isViewportInteracting = false,
): boolean {
  return (
    isPlaying &&
    !isViewportInteracting &&
    Math.abs(playbackTimestamp - centerTimestamp) > PLAYBACK_SYNC_EPSILON
  );
}

export function getOverlayVisibility(mode: TimelineOverlayMode): {
  showDetections: boolean;
  showVocalizations: boolean;
} {
  return {
    showDetections: mode === "detections",
    showVocalizations: mode === "vocalizations",
  };
}

export function toggleOverlayMode(
  currentMode: TimelineOverlayMode,
  requestedMode: Exclude<TimelineOverlayMode, "none">,
): TimelineOverlayMode {
  return currentMode === requestedMode ? "none" : requestedMode;
}
