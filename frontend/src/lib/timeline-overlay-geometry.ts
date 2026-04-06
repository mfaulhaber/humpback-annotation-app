import type {
  Detection,
  VocalizationLabel,
  VocalizationType,
} from "./timeline-contract.js";
import { timeToPixel, type DetectionLane, type TimeRange, type VocalizationWindow } from "./timeline-math.js";

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
}

export interface VocalizationDrawWindow {
  key: string;
  labels: VocalizationDrawLabel[];
  width: number;
  x: number;
  y: number;
}

const LABEL_COLORS: Record<string, string> = {
  background: "#8c97a8",
  humpback: "#f0a449",
  orca: "#4fa0ff",
  ship: "#ef5a5a",
};

const VOCALIZATION_PALETTE = [
  "#52b788",
  "#4ea8de",
  "#f4a261",
  "#e76f51",
  "#f6bd60",
  "#c77dff",
  "#90be6d",
  "#f28482",
  "#84a59d",
  "#f5cac3",
] as const;

export function detectionColor(detection: Detection): string {
  if (detection.label) {
    return LABEL_COLORS[detection.label] ?? "#7fd6bc";
  }

  const alpha = 0.18 + detection.avg_confidence * 0.52;
  return `rgba(142, 204, 193, ${alpha.toFixed(3)})`;
}

export function buildDetectionDrawRects(
  lanes: DetectionLane[],
  range: TimeRange,
  width: number,
  overlayHeight = 92,
): DetectionDrawRect[] {
  const laneCount = Math.max(
    1,
    lanes.reduce((max, lane) => Math.max(max, lane.lane + 1), 1),
  );
  const laneHeight = Math.max(10, Math.floor((overlayHeight - 8) / laneCount));

  return lanes.map((lane) => {
    const x = timeToPixel(lane.detection.start_utc, range, width);
    const endX = timeToPixel(lane.detection.end_utc, range, width);

    return {
      detection: lane.detection,
      fill: detectionColor(lane.detection),
      height: Math.max(8, laneHeight - 3),
      lane: lane.lane,
      stroke: "rgba(255,255,255,0.18)",
      width: Math.max(3, endX - x),
      x,
      y: 4 + lane.lane * laneHeight,
    };
  });
}

export function findDetectionRectAtPoint(
  rects: DetectionDrawRect[],
  x: number,
  y: number,
): DetectionDrawRect | null {
  return rects.find(
    (rect) =>
      x >= rect.x &&
      x <= rect.x + rect.width &&
      y >= rect.y &&
      y <= rect.y + rect.height,
  ) ?? null;
}

export function buildVocalizationColorMap(
  types: VocalizationType[],
): Map<string, string> {
  const colors = new Map<string, string>();

  types.forEach((entry, index) => {
    colors.set(entry.name, VOCALIZATION_PALETTE[index % VOCALIZATION_PALETTE.length]!);
  });

  return colors;
}

export function buildVocalizationDrawWindows(
  windows: VocalizationWindow[],
  range: TimeRange,
  width: number,
  types: VocalizationType[],
): VocalizationDrawWindow[] {
  const colorByType = buildVocalizationColorMap(types);

  return windows.map((window, index) => {
    const left = timeToPixel(window.start, range, width);
    const right = timeToPixel(window.end, range, width);
    const chipRow = index % 4;

    return {
      key: window.key,
      labels: window.labels.map((label) => {
        const stroke = colorByType.get(label.type) ?? "#7fd6bc";
        return {
          fill:
            label.source === "manual"
              ? `${stroke}22`
              : "rgba(13, 25, 40, 0.88)",
          key: `${window.key}:${label.type}:${label.source}`,
          source: label.source,
          stroke,
          text: label.type,
        };
      }),
      width: Math.max(12, right - left),
      x: Math.max(0, left),
      y: 8 + chipRow * 28,
    };
  });
}
