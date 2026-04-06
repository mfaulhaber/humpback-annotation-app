const PLAYBACK_SYNC_EPSILON = 0.001;

export type TimelineOverlayMode = "detections" | "vocalizations";

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
