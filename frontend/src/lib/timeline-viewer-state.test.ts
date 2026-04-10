import { describe, expect, it } from "vitest";

import {
  buildTimelineViewerHref,
  getOverlayVisibility,
  mergeTimelineViewDefaults,
  parseTimelineViewSearchParams,
  resolveInitialTimelineViewState,
  shouldSyncCenterTimestampFromPlayback,
  toggleOverlayMode,
} from "./timeline-viewer-state.js";
import {
  sampleTimelineEntry,
  sampleTimelineEntryWithViewerDefaults,
  sampleTimelineManifest,
} from "./timeline-test-fixtures.js";

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

  it("derives initial viewer state from timeline entry defaults", () => {
    expect(
      resolveInitialTimelineViewState(
        sampleTimelineManifest,
        sampleTimelineEntryWithViewerDefaults,
      ),
    ).toEqual({
      centerTimestamp: 1_711_930_250,
      overlayMode: "vocalizations",
      zoom: "5m",
    });
  });

  it("falls back to the existing viewer defaults when no entry defaults exist", () => {
    expect(
      resolveInitialTimelineViewState(sampleTimelineManifest, sampleTimelineEntry),
    ).toEqual({
      centerTimestamp: sampleTimelineManifest.job.end_timestamp,
      overlayMode: "detections",
      zoom: "1h",
    });
  });

  it("clamps an out-of-range starting position and chooses the nearest available zoom", () => {
    expect(
      resolveInitialTimelineViewState(
        {
          ...sampleTimelineManifest,
          tiles: {
            ...sampleTimelineManifest.tiles,
            zoom_levels: ["24h", "6h", "1h", "15m", "1m"],
          },
        },
        {
          ...sampleTimelineEntryWithViewerDefaults,
          starting_pos: sampleTimelineManifest.job.end_timestamp + 600,
        },
      ),
    ).toEqual({
      centerTimestamp: sampleTimelineManifest.job.end_timestamp,
      overlayMode: "vocalizations",
      zoom: "1m",
    });
  });

  it("builds a timeline viewer href with the provided defaults", () => {
    expect(
      buildTimelineViewerHref(
        sampleTimelineEntryWithViewerDefaults.job_id,
        sampleTimelineEntryWithViewerDefaults,
      ),
    ).toBe(
      "/8224c4a6-bc36-43db-ad59-e8933ef09115?starting_pos=1711930250&zoom_level=5m&view_mode=vocalizations",
    );
  });

  it("omits query params when no viewer defaults are present", () => {
    expect(
      buildTimelineViewerHref(sampleTimelineEntry.job_id, sampleTimelineEntry),
    ).toBe("/550e8400-e29b-41d4-a716-446655440000");
  });

  it("parses valid query params into viewer defaults", () => {
    expect(
      parseTimelineViewSearchParams(
        new URLSearchParams(
          "starting_pos=1711930500&zoom_level=15m&view_mode=detections",
        ),
      ),
    ).toEqual({
      starting_pos: 1_711_930_500,
      view_mode: "detections",
      zoom_level: "15m",
    });
  });

  it("ignores invalid query params and keeps only valid overrides", () => {
    expect(
      parseTimelineViewSearchParams(
        new URLSearchParams(
          "starting_pos=1711930.5&zoom_level=30s&view_mode=vocalizations",
        ),
      ),
    ).toEqual({
      view_mode: "vocalizations",
    });
  });

  it("lets query param defaults override the index defaults", () => {
    expect(
      mergeTimelineViewDefaults(sampleTimelineEntryWithViewerDefaults, {
        starting_pos: 1_711_930_500,
        view_mode: "detections",
        zoom_level: "15m",
      }),
    ).toEqual({
      starting_pos: 1_711_930_500,
      view_mode: "detections",
      zoom_level: "15m",
    });
  });
});
