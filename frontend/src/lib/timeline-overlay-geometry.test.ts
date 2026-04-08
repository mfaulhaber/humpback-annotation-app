import { describe, expect, it } from "vitest";

import {
  DETECTION_INDICATOR_FILL,
  LOWER_OVERLAY_STACK_BOTTOM_OFFSET,
  THIN_INDICATOR_WIDTH,
  VOCALIZATION_LABEL_PALETTE,
  VOCALIZATION_INDICATOR_FILL,
  VOCALIZATION_CHIP_HEIGHT,
  VOCALIZATION_LANE_GAP,
  buildDetectionDrawRects,
  buildVocalizationDrawWindows,
  findDetectionRectAtPoint,
  findVocalizationWindowAtPoint,
} from "./timeline-overlay-geometry.js";
import { type VocalizationLaneWindow } from "./timeline-math.js";

describe("timeline-overlay-geometry", () => {
  it("uses a full-height detection rectangle with a 5-second width at fine zooms", () => {
    const rects = buildDetectionDrawRects(
      [
        {
          detection: {
            row_id: "d1",
            start_utc: 10,
            end_utc: 20,
            avg_confidence: 0.8,
            peak_confidence: 0.92,
            label: "song",
          },
          lane: 0,
        },
      ],
      { start: 0, end: 100, span: 100 },
      500,
      320,
      "1m",
      5,
    );

    expect(rects[0]).toMatchObject({
      fill: DETECTION_INDICATOR_FILL,
      height: 320,
      width: 25,
      y: 0,
    });
  });

  it("keeps coarse zoom detection indicators thin", () => {
    const rects = buildDetectionDrawRects(
      [
        {
          detection: {
            row_id: "d1",
            start_utc: 10,
            end_utc: 20,
            avg_confidence: 0.8,
            peak_confidence: 0.92,
            label: "song",
          },
          lane: 0,
        },
      ],
      { start: 0, end: 3_600, span: 3_600 },
      500,
      320,
      "1h",
      5,
    );

    expect(rects[0]?.height).toBe(320);
    expect(rects[0]?.width).toBe(THIN_INDICATOR_WIDTH);
    expect(rects[0]?.y).toBe(0);
  });

  it("uses forgiving hit testing for the slim detection band", () => {
    const rect = {
      detection: {
        row_id: "d1",
        start_utc: 10,
        end_utc: 20,
        avg_confidence: 0.8,
        peak_confidence: 0.92,
        label: "song",
      },
      fill: "rgba(0,0,0,1)",
      height: 8,
      lane: 0,
      stroke: "rgba(255,255,255,1)",
      width: 12,
      x: 40,
      y: 200,
    };

    expect(findDetectionRectAtPoint([rect], 38, 198)).toBe(rect);
    expect(findDetectionRectAtPoint([rect], 20, 198)).toBeNull();
  });

  it("positions vocalization windows from the bottom upward and gives them indicator bars", () => {
    const windows: VocalizationLaneWindow[] = [
      {
        key: "first",
        start: 10,
        end: 20,
        labels: [
          {
            start_utc: 10,
            end_utc: 20,
            type: "Ascending Moan",
            confidence: 0.9,
            source: "manual",
          },
        ],
        lane: 0,
      },
      {
        key: "second",
        start: 11,
        end: 19,
        labels: [
          {
            start_utc: 11,
            end_utc: 19,
            type: "Descending Cry",
            confidence: 0.6,
            source: "inference",
          },
        ],
        lane: 1,
      },
    ];

    const drawWindows = buildVocalizationDrawWindows(
      windows,
      { start: 0, end: 100, span: 100 },
      500,
      [
        { id: 1, name: "Ascending Moan" },
        { id: 2, name: "Descending Cry" },
      ],
      320,
      "1m",
      5,
    );

    expect(drawWindows[0]?.y).toBeGreaterThan(drawWindows[1]!.y);
    expect(drawWindows[0]?.y).toBe(
      320 - LOWER_OVERLAY_STACK_BOTTOM_OFFSET - VOCALIZATION_CHIP_HEIGHT,
    );
    expect(drawWindows[0]?.indicatorWidth).toBe(25);
    expect(drawWindows[0]?.indicatorHeight).toBe(320);
    expect(drawWindows[0]?.indicatorFill).toBe(VOCALIZATION_INDICATOR_FILL);
    expect(drawWindows[0]?.hoverRows[0]).toMatchObject({
      confidence: 0.9,
      text: "Ascending Moan",
      textColor: VOCALIZATION_LABEL_PALETTE[0],
    });
    expect(drawWindows[0]?.labels[0]?.textColor).toBe(
      VOCALIZATION_LABEL_PALETTE[0],
    );
  });

  it("only shows vocalization labels at 5m and 1m, with 5m abbreviated to first letter ellipsis", () => {
    const windows: VocalizationLaneWindow[] = [
      {
        key: "label-window",
        start: 10,
        end: 20,
        labels: [
          {
            start_utc: 10,
            end_utc: 20,
            type: "Ascending Moan",
            confidence: 0.9,
            source: "manual",
          },
        ],
        lane: 0,
      },
    ];

    const at15m = buildVocalizationDrawWindows(
      windows,
      { start: 0, end: 100, span: 100 },
      500,
      [{ id: 1, name: "Ascending Moan" }],
      320,
      "15m",
      5,
    );
    const at5m = buildVocalizationDrawWindows(
      windows,
      { start: 0, end: 100, span: 100 },
      500,
      [{ id: 1, name: "Ascending Moan" }],
      320,
      "5m",
      5,
    );
    const at1m = buildVocalizationDrawWindows(
      windows,
      { start: 0, end: 100, span: 100 },
      500,
      [{ id: 1, name: "Ascending Moan" }],
      320,
      "1m",
      5,
    );

    expect(at15m[0]?.labels).toEqual([]);
    expect(at5m[0]?.labels[0]?.text).toBe("A...");
    expect(at1m[0]?.labels[0]?.text).toBe("Ascending Moan");
  });

  it("rotates distinct colors across vocalization types", () => {
    const drawWindows = buildVocalizationDrawWindows(
      [
        {
          key: "color-window",
          start: 10,
          end: 20,
          labels: [
            {
              start_utc: 10,
              end_utc: 20,
              type: "Ascending Moan",
              confidence: 0.9,
              source: "manual",
            },
            {
              start_utc: 10,
              end_utc: 20,
              type: "Descending Cry",
              confidence: 0.8,
              source: "manual",
            },
          ],
          lane: 0,
        },
      ],
      { start: 0, end: 100, span: 100 },
      500,
      [
        { id: 1, name: "Ascending Moan" },
        { id: 2, name: "Descending Cry" },
      ],
      320,
      "1m",
      5,
    );

    expect(drawWindows[0]?.labels[0]?.textColor).not.toBe(
      drawWindows[0]?.labels[1]?.textColor,
    );
  });

  it("hit-tests vocalization label stacks before falling back to indicator bars", () => {
    const drawWindows = buildVocalizationDrawWindows(
      [
        {
          key: "hover-window",
          start: 10,
          end: 20,
          labels: [
            {
              start_utc: 10,
              end_utc: 20,
              type: "Ascending Moan",
              confidence: 0.9,
              source: "manual",
            },
            {
              start_utc: 10,
              end_utc: 20,
              type: "Descending Cry",
              confidence: 0.6,
              source: "inference",
            },
          ],
          lane: 0,
        },
      ],
      { start: 0, end: 100, span: 100 },
      500,
      [
        { id: 1, name: "Ascending Moan" },
        { id: 2, name: "Descending Cry" },
      ],
      320,
      "1m",
      5,
    );

    const hovered = drawWindows[0]!;
    const chipStackTop =
      hovered.y -
      (hovered.labels.length - 1) *
        (VOCALIZATION_CHIP_HEIGHT + VOCALIZATION_LANE_GAP);

    expect(
      findVocalizationWindowAtPoint(drawWindows, hovered.x + 10, chipStackTop + 4),
    ).toBe(hovered);
    expect(findVocalizationWindowAtPoint(drawWindows, hovered.x + 2, 40)).toBe(
      hovered,
    );
    expect(findVocalizationWindowAtPoint(drawWindows, hovered.x + 40, 40)).toBeNull();
  });

  it("uses the indicator bar as the hover target when vocalization labels are hidden", () => {
    const drawWindows = buildVocalizationDrawWindows(
      [
        {
          key: "coarse-hover",
          start: 10,
          end: 20,
          labels: [
            {
              start_utc: 10,
              end_utc: 20,
              type: "Ascending Moan",
              confidence: 0.9,
              source: "manual",
            },
          ],
          lane: 0,
        },
      ],
      { start: 0, end: 100, span: 100 },
      500,
      [{ id: 1, name: "Ascending Moan" }],
      320,
      "15m",
      5,
    );

    const hovered = drawWindows[0]!;

    expect(hovered.labels).toEqual([]);
    expect(findVocalizationWindowAtPoint(drawWindows, hovered.x + 2, 12)).toBe(
      hovered,
    );
  });
});
