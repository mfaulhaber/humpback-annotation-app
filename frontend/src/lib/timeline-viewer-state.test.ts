import { describe, expect, it } from "vitest";

import {
  getOverlayVisibility,
  shouldSyncCenterTimestampFromPlayback,
  toggleOverlayMode,
} from "./timeline-viewer-state.js";

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

  it("exposes an exclusive overlay mode for detections", () => {
    expect(getOverlayVisibility("detections")).toEqual({
      showDetections: true,
      showVocalizations: false,
    });
  });

  it("exposes an exclusive overlay mode for vocalizations", () => {
    expect(getOverlayVisibility("vocalizations")).toEqual({
      showDetections: false,
      showVocalizations: true,
    });
  });

  it("hides both overlays when no mode is selected", () => {
    expect(getOverlayVisibility("none")).toEqual({
      showDetections: false,
      showVocalizations: false,
    });
  });

  it("toggles an active overlay mode back off", () => {
    expect(toggleOverlayMode("detections", "detections")).toBe("none");
    expect(toggleOverlayMode("vocalizations", "vocalizations")).toBe("none");
  });

  it("switches to the requested overlay mode when a different mode is active", () => {
    expect(toggleOverlayMode("none", "detections")).toBe("detections");
    expect(toggleOverlayMode("detections", "vocalizations")).toBe(
      "vocalizations",
    );
  });
});
