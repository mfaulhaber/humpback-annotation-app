import { describe, expect, it } from "vitest";

import {
  audioChunkPath,
  availableZoomLevels,
  chunkForTimestamp,
  chunkTimeRange,
  defaultZoomForDuration,
  isTimelineIndex,
  isTimelineManifest,
  preferredInitialZoom,
  tilePath,
  tileTimeRange,
} from "./timeline-contract.js";
import {
  sampleTimelineEntry,
  sampleTimelineEntryWithHints,
  sampleTimelineEntryWithViewerDefaults,
  sampleTimelineManifest,
} from "./timeline-test-fixtures.js";

describe("timeline-contract", () => {
  it("accepts manifests with string vocalization type ids", () => {
    expect(isTimelineManifest(sampleTimelineManifest)).toBe(true);
  });

  it("validates timeline indexes built from export entries", () => {
    expect(isTimelineIndex({ timelines: [sampleTimelineEntry] })).toBe(true);
    expect(isTimelineIndex({ timelines: [sampleTimelineEntryWithHints] })).toBe(true);
    expect(isTimelineIndex({ timelines: [sampleTimelineEntryWithViewerDefaults] })).toBe(
      true,
    );
    expect(isTimelineIndex({ timelines: [{ ...sampleTimelineEntry, job_id: 42 }] })).toBe(
      false,
    );
    expect(
      isTimelineIndex({
        timelines: [{ ...sampleTimelineEntryWithHints, hints: 42 }],
      }),
    ).toBe(false);
    expect(
      isTimelineIndex({
        timelines: [{ ...sampleTimelineEntry, starting_pos: "1711930250" }],
      }),
    ).toBe(false);
    expect(
      isTimelineIndex({
        timelines: [{ ...sampleTimelineEntry, starting_pos: 1_711_930_250.5 }],
      }),
    ).toBe(false);
    expect(
      isTimelineIndex({
        timelines: [
          {
            ...sampleTimelineEntry,
            starting_pos: sampleTimelineEntry.end_timestamp + 60,
          },
        ],
      }),
    ).toBe(false);
    expect(
      isTimelineIndex({
        timelines: [{ ...sampleTimelineEntry, zoom_level: "30s" }],
      }),
    ).toBe(false);
    expect(
      isTimelineIndex({
        timelines: [{ ...sampleTimelineEntry, view_mode: "none" }],
      }),
    ).toBe(false);
    expect(
      isTimelineIndex({
        timelines: [{ ...sampleTimelineEntry, job_id: "demo.v1" }],
      }),
    ).toBe(false);
  });

  it("rejects manifests whose job id is not a UUID", () => {
    expect(
      isTimelineManifest({
        ...sampleTimelineManifest,
        job: {
          ...sampleTimelineManifest.job,
          id: "demo.v1",
        },
      }),
    ).toBe(false);
  });

  it("builds zero-padded asset paths and time ranges", () => {
    expect(tilePath(sampleTimelineManifest.job.id, "5m", 3)).toBe(
      "/data/550e8400-e29b-41d4-a716-446655440000/tiles/5m/tile_0003.png",
    );
    expect(audioChunkPath(sampleTimelineManifest.job.id, 12)).toBe(
      "/data/550e8400-e29b-41d4-a716-446655440000/audio/chunk_0012.mp3",
    );
    expect(tileTimeRange(sampleTimelineManifest, "1h", 1)).toEqual({
      start: 1_711_933_200,
      end: 1_711_936_800,
    });
    expect(chunkTimeRange(sampleTimelineManifest, 0)).toEqual({
      start: 1_711_929_600,
      end: 1_711_929_900,
    });
  });

  it("derives chunk placement and default zoom levels", () => {
    expect(chunkForTimestamp(sampleTimelineManifest, 1_711_930_250)).toBe(2);
    expect(defaultZoomForDuration(45)).toBe("1m");
    expect(defaultZoomForDuration(1_200)).toBe("1h");
    expect(availableZoomLevels(sampleTimelineManifest)).toEqual(
      sampleTimelineManifest.tiles.zoom_levels,
    );
    expect(preferredInitialZoom(sampleTimelineManifest)).toBe("1h");
    expect(
      preferredInitialZoom({
        ...sampleTimelineManifest,
        tiles: {
          ...sampleTimelineManifest.tiles,
          zoom_levels: ["24h", "6h", "15m", "5m", "1m"],
        },
      }),
    ).toBe("15m");
  });
});
