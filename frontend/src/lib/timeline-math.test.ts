import { describe, expect, it } from "vitest";

import {
  buildDetectionLanes,
  deriveTimelineTitle,
  formatDurationShort,
  getViewportRange,
  getVisibleTileIndices,
  getVisibleVocalizationWindows,
} from "./timeline-math.js";
import {
  sampleTimelineEntry,
  sampleTimelineManifest,
} from "./timeline-test-fixtures.js";

describe("timeline-math", () => {
  it("keeps the playhead timestamp centered in the viewport near job edges", () => {
    expect(
      getViewportRange(sampleTimelineManifest, "1h", sampleTimelineManifest.job.start_timestamp + 60),
    ).toEqual({
      start: 1_711_927_860,
      end: 1_711_931_460,
      span: 3_600,
    });

    expect(
      getViewportRange(sampleTimelineManifest, "1h", sampleTimelineManifest.job.end_timestamp - 60),
    ).toEqual({
      start: 1_711_934_940,
      end: 1_711_938_540,
      span: 3_600,
    });
  });

  it("still centers the playhead when the zoom span is wider than the job", () => {
    expect(
      getViewportRange(sampleTimelineManifest, "24h", sampleTimelineManifest.job.start_timestamp),
    ).toEqual({
      start: 1_711_886_400,
      end: 1_711_972_800,
      span: 86_400,
    });
  });

  it("selects visible tiles with overscan but stays within bounds", () => {
    const range = getViewportRange(
      sampleTimelineManifest,
      "15m",
      sampleTimelineManifest.job.start_timestamp + 900,
    );

    expect(getVisibleTileIndices(sampleTimelineManifest, "15m", range)).toEqual([0, 1, 2]);
  });

  it("reuses detection lanes and groups vocalization windows", () => {
    expect(buildDetectionLanes(sampleTimelineManifest.detections)).toEqual([
      { detection: sampleTimelineManifest.detections[0], lane: 0 },
      { detection: sampleTimelineManifest.detections[1], lane: 1 },
      { detection: sampleTimelineManifest.detections[2], lane: 0 },
    ]);

    const windows = getVisibleVocalizationWindows(sampleTimelineManifest.vocalization_labels, {
      start: sampleTimelineManifest.job.start_timestamp,
      end: sampleTimelineManifest.job.end_timestamp,
      span:
        sampleTimelineManifest.job.end_timestamp - sampleTimelineManifest.job.start_timestamp,
    });

    expect(windows).toHaveLength(2);
    expect(windows[0]).toMatchObject({
      start: 1_711_930_000,
      end: 1_711_930_060,
    });
    expect(windows[0]?.labels).toHaveLength(2);
  });

  it("formats viewer-facing labels from timeline metadata", () => {
    expect(deriveTimelineTitle(sampleTimelineEntry)).toBe("Orcasound Lab / Ar V2 Promoted");
    expect(formatDurationShort(3_660)).toBe("1h 1m");
  });
});
