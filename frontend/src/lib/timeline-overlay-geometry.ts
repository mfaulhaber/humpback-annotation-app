import type {
  Detection,
  VocalizationLabel,
  VocalizationType,
  ZoomLevel,
} from "./timeline-contract.js";
import {
  timeToPixel,
  type DetectionLane,
  type TimeRange,
  type VocalizationLaneWindow,
} from "./timeline-math.js";

export interface DetectionDrawRect {
  detection: Detection;
  fill: string;
  height: number;
  lane: number;
  stroke: string;
  width: number;
  x: number;
  y: number;
}

export interface VocalizationDrawLabel {
  fill: string;
  key: string;
  source: VocalizationLabel["source"];
  stroke: string;
  text: string;
  textColor: string;
}

export interface VocalizationHoverRow {
  confidence: number;
  key: string;
  source: VocalizationLabel["source"];
  stroke: string;
  text: string;
  textColor: string;
}

export interface VocalizationDrawWindow {
  hoverRows: VocalizationHoverRow[];
  indicatorFill: string;
  indicatorHeight: number;
  indicatorWidth: number;
  key: string;
  labels: VocalizationDrawLabel[];
  width: number;
  x: number;
  y: number;
}

export const DETECTION_INDICATOR_FILL = "rgba(64, 224, 192, 0.25)";
export const VOCALIZATION_INDICATOR_FILL = "rgba(168, 130, 220, 0.4)";
export const VOCALIZATION_CHIP_HEIGHT = 14;
export const VOCALIZATION_LANE_GAP = 6;
export const LOWER_OVERLAY_STACK_BOTTOM_OFFSET = 46;
export const THIN_INDICATOR_WIDTH = 3;
export const VOCALIZATION_LABEL_PALETTE = [
  "rgb(232, 121, 249)",
  "rgb(125, 211, 252)",
  "rgb(94, 234, 212)",
  "rgb(251, 191, 36)",
  "rgb(163, 230, 53)",
  "rgb(196, 181, 253)",
  "rgb(251, 113, 133)",
] as const;

export function detectionColor(detection: Detection): string {
  void detection;
  return DETECTION_INDICATOR_FILL;
}

export function buildDetectionDrawRects(
  lanes: DetectionLane[],
  range: TimeRange,
  width: number,
  trackHeight: number,
  zoom: ZoomLevel,
  indicatorWindowSeconds: number,
): DetectionDrawRect[] {
  const indicatorWidth = getIndicatorWidth(
    range,
    width,
    zoom,
    indicatorWindowSeconds,
  );

  return lanes.map((lane) => {
    const x = timeToPixel(lane.detection.start_utc, range, width);

    return {
      detection: lane.detection,
      fill: detectionColor(lane.detection),
      height: trackHeight,
      lane: lane.lane,
      stroke: "rgba(0, 0, 0, 0)",
      width: indicatorWidth,
      x,
      y: 0,
    };
  });
}

export function findDetectionRectAtPoint(
  rects: DetectionDrawRect[],
  x: number,
  y: number,
  tolerance = 4,
): DetectionDrawRect | null {
  return rects.find(
    (rect) =>
      x >= rect.x - tolerance &&
      x <= rect.x + rect.width + tolerance &&
      y >= rect.y - tolerance &&
      y <= rect.y + rect.height + tolerance,
  ) ?? null;
}

export function buildVocalizationColorMap(
  types: VocalizationType[],
): Map<string, string> {
  const colors = new Map<string, string>();

  types.forEach((entry, index) => {
    colors.set(
      entry.name,
      VOCALIZATION_LABEL_PALETTE[index % VOCALIZATION_LABEL_PALETTE.length]!,
    );
  });

  return colors;
}

function shouldRenderVocalizationLabels(zoom: ZoomLevel): boolean {
  return zoom === "5m" || zoom === "1m";
}

function shouldUseWindowScaledIndicatorWidth(zoom: ZoomLevel): boolean {
  return zoom === "15m" || zoom === "5m" || zoom === "1m";
}

function formatVocalizationLabelText(type: string, zoom: ZoomLevel): string {
  const trimmed = type.trim();
  if (!trimmed) {
    return "";
  }

  if (zoom === "5m") {
    return `${trimmed.charAt(0).toUpperCase()}...`;
  }

  return trimmed;
}

function fallbackVocalizationColor(type: string): string {
  const value = [...type].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return VOCALIZATION_LABEL_PALETTE[value % VOCALIZATION_LABEL_PALETTE.length]!;
}

function getIndicatorWidth(
  range: TimeRange,
  width: number,
  zoom: ZoomLevel,
  indicatorWindowSeconds: number,
): number {
  if (
    range.span <= 0 ||
    width <= 0 ||
    indicatorWindowSeconds <= 0
  ) {
    return THIN_INDICATOR_WIDTH;
  }

  if (!shouldUseWindowScaledIndicatorWidth(zoom)) {
    return THIN_INDICATOR_WIDTH;
  }

  return Math.max(
    THIN_INDICATOR_WIDTH,
    Math.round((indicatorWindowSeconds / range.span) * width),
  );
}

export function buildVocalizationDrawWindows(
  windows: VocalizationLaneWindow[],
  range: TimeRange,
  width: number,
  types: VocalizationType[],
  trackHeight: number,
  zoom: ZoomLevel,
  indicatorWindowSeconds: number,
): VocalizationDrawWindow[] {
  const colorByType = buildVocalizationColorMap(types);
  const showLabels = shouldRenderVocalizationLabels(zoom);
  const indicatorWidth = getIndicatorWidth(
    range,
    width,
    zoom,
    indicatorWindowSeconds,
  );
  const maxLabelsPerWindow = Math.max(
    1,
    ...windows.map((window) =>
      showLabels ? Math.max(window.labels.length, 1) : 1,
    ),
  );
  const stackBottom = Math.max(0, trackHeight - LOWER_OVERLAY_STACK_BOTTOM_OFFSET);
  const laneBlockHeight =
    maxLabelsPerWindow * VOCALIZATION_CHIP_HEIGHT +
    (maxLabelsPerWindow - 1) * VOCALIZATION_LANE_GAP;

  return windows.map((window) => {
    const left = timeToPixel(window.start, range, width);
    const right = timeToPixel(window.end, range, width);
    const hoverRows = window.labels
      .map((label, index) => {
        const trimmedType = label.type.trim();
        if (!trimmedType) {
          return null;
        }

        const accent =
          colorByType.get(trimmedType) ?? fallbackVocalizationColor(trimmedType);

        return {
          confidence: label.confidence,
          key: `${window.key}:${trimmedType}:${label.source}:${index}`,
          source: label.source,
          stroke: accent,
          text: trimmedType,
          textColor: accent,
        };
      })
      .filter((row): row is VocalizationHoverRow => row != null);
    const labels = showLabels
      ? hoverRows
          .map((row) => {
            const text = formatVocalizationLabelText(row.text, zoom);
            if (!text) {
              return null;
            }

            return {
              fill: "transparent",
              key: row.key,
              source: row.source,
              stroke: row.stroke,
              text,
              textColor: row.textColor,
            };
          })
          .filter((label): label is VocalizationDrawLabel => label != null)
      : [];

    return {
      hoverRows,
      indicatorFill: VOCALIZATION_INDICATOR_FILL,
      indicatorHeight: trackHeight,
      indicatorWidth,
      key: window.key,
      labels,
      width: Math.max(24, right - left),
      x: Math.max(0, left),
      y:
        stackBottom -
        VOCALIZATION_CHIP_HEIGHT -
        window.lane * (laneBlockHeight + VOCALIZATION_LANE_GAP),
    };
  });
}

function getVocalizationLabelStackTop(window: VocalizationDrawWindow): number {
  if (window.labels.length <= 1) {
    return window.y;
  }

  return (
    window.y -
    (window.labels.length - 1) * (VOCALIZATION_CHIP_HEIGHT + VOCALIZATION_LANE_GAP)
  );
}

function isPointWithinVocalizationLabelStack(
  window: VocalizationDrawWindow,
  x: number,
  y: number,
  tolerance: number,
): boolean {
  if (window.labels.length === 0) {
    return false;
  }

  return (
    x >= window.x - tolerance &&
    x <= window.x + window.width + tolerance &&
    y >= getVocalizationLabelStackTop(window) - tolerance &&
    y <= window.y + VOCALIZATION_CHIP_HEIGHT + tolerance
  );
}

function isPointWithinVocalizationIndicator(
  window: VocalizationDrawWindow,
  x: number,
  y: number,
  tolerance: number,
): boolean {
  return (
    x >= window.x - tolerance &&
    x <= window.x + window.indicatorWidth + tolerance &&
    y >= -tolerance &&
    y <= window.indicatorHeight + tolerance
  );
}

export function findVocalizationWindowAtPoint(
  windows: VocalizationDrawWindow[],
  x: number,
  y: number,
  tolerance = 4,
): VocalizationDrawWindow | null {
  for (let index = windows.length - 1; index >= 0; index -= 1) {
    const window = windows[index]!;
    if (isPointWithinVocalizationLabelStack(window, x, y, tolerance)) {
      return window;
    }
  }

  for (let index = windows.length - 1; index >= 0; index -= 1) {
    const window = windows[index]!;
    if (isPointWithinVocalizationIndicator(window, x, y, tolerance)) {
      return window;
    }
  }

  return null;
}
