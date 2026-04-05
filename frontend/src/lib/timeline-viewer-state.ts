const PLAYBACK_SYNC_EPSILON = 0.001;

export function shouldSyncCenterTimestampFromPlayback(
  centerTimestamp: number,
  playbackTimestamp: number,
  isPlaying: boolean,
): boolean {
  return (
    isPlaying &&
    Math.abs(playbackTimestamp - centerTimestamp) > PLAYBACK_SYNC_EPSILON
  );
}
