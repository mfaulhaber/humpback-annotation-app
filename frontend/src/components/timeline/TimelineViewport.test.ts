import { describe, expect, it } from "vitest";

import {
  formatDetectionHoverText,
  getHoverTooltipPosition,
  formatVocalizationHoverText,
} from "./TimelineViewport.js";

describe("TimelineViewport helpers", () => {
  it("formats detection hover text from the average confidence only", () => {
    expect(
      formatDetectionHoverText({
        avg_confidence: 0.74,
      }),
    ).toBe("Detection: 74%");
  });

  it("formats vocalization hover rows as type plus confidence", () => {
    expect(
      formatVocalizationHoverText({
        confidence: 0.9,
        text: "Moan",
      }),
    ).toBe("Moan: 90%");
  });

  it("positions the hover card near the pointer when there is room", () => {
    expect(
      getHoverTooltipPosition({
        anchorX: 48,
        anchorY: 56,
        tooltipHeight: 60,
        tooltipWidth: 120,
        trackHeight: 200,
        trackWidth: 320,
      }),
    ).toEqual({
      x: 60,
      y: 68,
    });
  });

  it("clamps the hover card inside the track and flips it upward near the bottom edge", () => {
    expect(
      getHoverTooltipPosition({
        anchorX: 228,
        anchorY: 144,
        tooltipHeight: 72,
        tooltipWidth: 120,
        trackHeight: 180,
        trackWidth: 260,
      }),
    ).toEqual({
      x: 128,
      y: 60,
    });
  });
});
