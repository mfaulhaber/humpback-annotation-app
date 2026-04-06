import { describe, expect, it } from "vitest";

import {
  clampPlaybackTimestamp,
  derivePlaybackTimestampFromAudio,
  resolveLivePlaybackTimestamp,
} from "./timeline-playback-clock.js";

describe("timeline-playback-clock", () => {
  it("derives an absolute timestamp from the active chunk offset", () => {
    expect(
      derivePlaybackTimestampFromAudio(
        1_711_929_600,
        300,
        2,
        14.25,
        1_711_936_800,
      ),
    ).toBe(1_711_930_214.25);
  });

  it("clamps derived timestamps to the job bounds", () => {
    expect(
      clampPlaybackTimestamp(1_711_929_500, 1_711_929_600, 1_711_936_800),
    ).toBe(1_711_929_600);
    expect(
      clampPlaybackTimestamp(1_711_936_900, 1_711_929_600, 1_711_936_800),
    ).toBe(1_711_936_800);
  });

  it("prefers a pending seek target while playback is repositioning", () => {
    expect(
      resolveLivePlaybackTimestamp({
        audioCurrentTime: 0,
        chunkDurationSec: 300,
        chunkIndex: 0,
        fallbackTimestamp: 1_711_929_900,
        jobEndTimestamp: 1_711_936_800,
        jobStartTimestamp: 1_711_929_600,
        pendingSeekTimestamp: 1_711_930_455.5,
      }),
    ).toBe(1_711_930_455.5);
  });

  it("falls back to the stored timestamp when the audio snapshot is unavailable", () => {
    expect(
      resolveLivePlaybackTimestamp({
        audioCurrentTime: null,
        chunkDurationSec: 300,
        chunkIndex: null,
        fallbackTimestamp: 1_711_930_120,
        jobEndTimestamp: 1_711_936_800,
        jobStartTimestamp: 1_711_929_600,
      }),
    ).toBe(1_711_930_120);
  });
});
