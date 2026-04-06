export interface TimelinePlaybackClockSnapshot {
  audioCurrentTime: number | null;
  chunkDurationSec: number;
  chunkIndex: number | null;
  fallbackTimestamp: number;
  jobEndTimestamp: number;
  jobStartTimestamp: number;
  pendingSeekTimestamp?: number | null;
}

export function clampPlaybackTimestamp(
  timestamp: number,
  jobStartTimestamp: number,
  jobEndTimestamp: number,
): number {
  return Math.min(jobEndTimestamp, Math.max(jobStartTimestamp, timestamp));
}

export function derivePlaybackTimestampFromAudio(
  jobStartTimestamp: number,
  chunkDurationSec: number,
  chunkIndex: number,
  audioCurrentTime: number,
  jobEndTimestamp: number,
): number {
  const safeOffset = Number.isFinite(audioCurrentTime)
    ? Math.max(0, audioCurrentTime)
    : 0;

  return clampPlaybackTimestamp(
    jobStartTimestamp + chunkIndex * chunkDurationSec + safeOffset,
    jobStartTimestamp,
    jobEndTimestamp,
  );
}

export function resolveLivePlaybackTimestamp(
  snapshot: TimelinePlaybackClockSnapshot,
): number {
  if (snapshot.pendingSeekTimestamp != null) {
    return clampPlaybackTimestamp(
      snapshot.pendingSeekTimestamp,
      snapshot.jobStartTimestamp,
      snapshot.jobEndTimestamp,
    );
  }

  if (snapshot.chunkIndex == null || snapshot.audioCurrentTime == null) {
    return clampPlaybackTimestamp(
      snapshot.fallbackTimestamp,
      snapshot.jobStartTimestamp,
      snapshot.jobEndTimestamp,
    );
  }

  return derivePlaybackTimestampFromAudio(
    snapshot.jobStartTimestamp,
    snapshot.chunkDurationSec,
    snapshot.chunkIndex,
    snapshot.audioCurrentTime,
    snapshot.jobEndTimestamp,
  );
}
