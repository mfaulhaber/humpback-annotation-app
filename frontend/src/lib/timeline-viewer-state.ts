const PLAYBACK_SYNC_EPSILON = 0.001;

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
