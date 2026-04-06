import { describe, expect, it } from "vitest";

import { drawTimelineCanvas, type TimelineCanvasContextLike } from "./timeline-canvas-renderer.js";
import {
  buildDetectionDrawRects,
  buildVocalizationDrawWindows,
} from "./timeline-overlay-geometry.js";
import { buildDetectionLanes, buildVocalizationLanes } from "./timeline-math.js";
import { sampleTimelineManifest } from "./timeline-test-fixtures.js";

class FakeCanvasContext implements TimelineCanvasContextLike {
  fillStyle: string | CanvasGradient | CanvasPattern = "";
  font = "";
  lineWidth = 1;
  strokeStyle: string | CanvasGradient | CanvasPattern = "";
  textBaseline: CanvasTextBaseline = "alphabetic";

  readonly calls: string[] = [];

  beginPath(): void {
    this.calls.push("beginPath");
  }

  clearRect(): void {
    this.calls.push("clearRect");
  }

  drawImage(): void {
    this.calls.push("drawImage");
  }

  fillRect(): void {
    this.calls.push("fillRect");
  }

  fillText(text: string): void {
    this.calls.push(`fillText:${text}`);
  }

  lineTo(): void {
    this.calls.push("lineTo");
  }

  measureText(text: string) {
    return { width: text.length * 7 };
  }

  moveTo(): void {
    this.calls.push("moveTo");
  }

  restore(): void {
    this.calls.push("restore");
  }

  save(): void {
    this.calls.push("save");
  }

  setTransform(): void {
    this.calls.push("setTransform");
  }

  stroke(): void {
    this.calls.push("stroke");
  }

  strokeRect(_: number, y: number): void {
    this.calls.push(`strokeRect:${y}`);
  }
}

describe("timeline-canvas-renderer", () => {
  it("draws tiles, vocalizations, and detections in one frame", () => {
    const context = new FakeCanvasContext();
    const range = {
      end: sampleTimelineManifest.job.start_timestamp + 300,
      span: 300,
      start: sampleTimelineManifest.job.start_timestamp,
    };
    const detectionRects = buildDetectionDrawRects(
      buildDetectionLanes(sampleTimelineManifest.detections),
      range,
      900,
      336,
    );
    const vocalizationWindows = buildVocalizationDrawWindows(
      buildVocalizationLanes([
        {
          end: sampleTimelineManifest.vocalization_labels[0]!.end_utc,
          key: "window",
          labels: sampleTimelineManifest.vocalization_labels.slice(0, 2),
          start: sampleTimelineManifest.vocalization_labels[0]!.start_utc,
        },
      ]),
      range,
      900,
      sampleTimelineManifest.vocalization_types,
      336,
      "1m",
    );

    drawTimelineCanvas(context, {
      detectionRects,
      height: 336,
      pixelRatio: 2,
      tileItems: [
        {
          image: {} as CanvasImageSource,
          width: 450,
          x: 0,
        },
        {
          image: null,
          width: 450,
          x: 450,
        },
      ],
      vocalizationWindows,
      width: 900,
    });

    expect(context.calls).toContain("drawImage");
    expect(context.calls.some((call) => call.startsWith("strokeRect:"))).toBe(
      true,
    );
    expect(context.calls.some((call) => call.startsWith("fillText:"))).toBe(true);
  });

  it("stacks vocalization labels vertically upward within a window", () => {
    const context = new FakeCanvasContext();
    const range = {
      end: sampleTimelineManifest.job.start_timestamp + 300,
      span: 300,
      start: sampleTimelineManifest.job.start_timestamp,
    };

    const vocalizationWindows = buildVocalizationDrawWindows(
      buildVocalizationLanes([
        {
          end: sampleTimelineManifest.vocalization_labels[0]!.end_utc,
          key: "window",
          labels: [
            {
              ...sampleTimelineManifest.vocalization_labels[0]!,
              type: "Ascending Moan",
            },
            {
              ...sampleTimelineManifest.vocalization_labels[1]!,
              type: "Descending Cry",
            },
          ],
          start: sampleTimelineManifest.vocalization_labels[0]!.start_utc,
        },
      ]),
      range,
      900,
      [
        { id: 1, name: "Ascending Moan" },
        { id: 2, name: "Descending Cry" },
      ],
      336,
      "1m",
    );

    drawTimelineCanvas(context, {
      detectionRects: [],
      height: 336,
      pixelRatio: 2,
      tileItems: [],
      vocalizationWindows,
      width: 900,
    });

    const strokeCalls = context.calls.filter((call) =>
      call.startsWith("strokeRect:"),
    );
    expect(strokeCalls).toHaveLength(2);
    const firstY = Number(strokeCalls[0]!.split(":")[1]);
    const secondY = Number(strokeCalls[1]!.split(":")[1]);
    expect(secondY).toBeLessThan(firstY);
  });
});
