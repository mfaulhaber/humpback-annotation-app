import { describe, expect, it } from "vitest";

import { shouldSyncCenterTimestampFromPlayback } from "./timeline-viewer-state.js";

describe("timeline-viewer-state", () => {
  it("follows the playback clock while audio is playing", () => {
    expect(shouldSyncCenterTimestampFromPlayback(120, 132, true)).toBe(true);
  });

  it("does not override manual viewport movement while playback is paused", () => {
    expect(shouldSyncCenterTimestampFromPlayback(120, 132, false)).toBe(false);
  });

  it("does not override manual viewport movement during an active drag", () => {
    expect(shouldSyncCenterTimestampFromPlayback(120, 132, true, true)).toBe(
      false,
    );
  });

  it("ignores tiny floating-point jitter", () => {
    expect(shouldSyncCenterTimestampFromPlayback(120, 120.0005, true)).toBe(
      false,
    );
  });
});
