import {
  VIEWPORT_SPANS,
  type Detection,
  type TimelineEntry,
  type TimelineManifest,
  type VocalizationLabel,
  type ZoomLevel,
} from "./timeline-contract.js";

export interface TimeRange {
  start: number;
  end: number;
  span: number;
}

export interface VocalizationWindow {
  key: string;
  start: number;
  end: number;
  labels: VocalizationLabel[];
}

export interface DetectionLane {
  detection: Detection;
  lane: number;
}

const TICK_STEPS: Record<ZoomLevel, number> = {
  "24h": 14400,
  "6h": 3600,
  "1h": 600,
  "15m": 300,
  "5m": 60,
  "1m": 10,
};

export function clampTimestamp(
  manifest: TimelineManifest,
  timestamp: number,
): number {
  return Math.min(
    manifest.job.end_timestamp,
    Math.max(manifest.job.start_timestamp, timestamp),
  );
}

export function getViewportRange(
  manifest: TimelineManifest,
  zoom: ZoomLevel,
  centerTimestamp: number,
): TimeRange {
  const startBound = manifest.job.start_timestamp;
  const endBound = manifest.job.end_timestamp;
  const jobSpan = endBound - startBound;
  const requestedSpan = VIEWPORT_SPANS[zoom];

  if (jobSpan <= requestedSpan) {
    return {
      start: startBound,
      end: endBound,
      span: Math.max(jobSpan, 1),
    };
  }

  const clampedCenter = clampTimestamp(manifest, centerTimestamp);
  const halfSpan = requestedSpan / 2;

  let start = clampedCenter - halfSpan;
  let end = clampedCenter + halfSpan;

  if (start < startBound) {
    start = startBound;
    end = start + requestedSpan;
  }

  if (end > endBound) {
    end = endBound;
    start = end - requestedSpan;
  }

  return {
    start,
    end,
    span: end - start,
  };
}

export function timeToPixel(
  timestamp: number,
  range: TimeRange,
  width: number,
): number {
  if (range.span <= 0 || width <= 0) {
    return 0;
  }

  return ((timestamp - range.start) / range.span) * width;
}

export function pixelToTimestamp(
  pixel: number,
  range: TimeRange,
  width: number,
): number {
  if (width <= 0) {
    return range.start;
  }

  return range.start + (pixel / width) * range.span;
}

export function getVisibleTileIndices(
  manifest: TimelineManifest,
  zoom: ZoomLevel,
  range: TimeRange,
  overscan = 1,
): number[] {
  const duration = manifest.tiles.tile_durations[zoom];
  const count = manifest.tiles.tile_counts[zoom];

  if (duration <= 0 || count <= 0) {
    return [];
  }

  const offsetStart = range.start - manifest.job.start_timestamp;
  const offsetEnd = range.end - manifest.job.start_timestamp;
  const firstIndex = Math.max(0, Math.floor(offsetStart / duration) - overscan);
  const lastIndex = Math.min(
    count - 1,
    Math.floor(offsetEnd / duration) + overscan,
  );

  const indices: number[] = [];
  for (let index = firstIndex; index <= lastIndex; index += 1) {
    indices.push(index);
  }

  return indices;
}

export function getVisibleDetections(
  detections: Detection[],
  range: TimeRange,
): Detection[] {
  return detections.filter(
    (detection) =>
      detection.end_utc >= range.start && detection.start_utc <= range.end,
  );
}

export function buildDetectionLanes(
  detections: Detection[],
): DetectionLane[] {
  const sorted = [...detections].sort((left, right) => {
    if (left.start_utc !== right.start_utc) {
      return left.start_utc - right.start_utc;
    }

    return left.end_utc - right.end_utc;
  });

  const laneEnds: number[] = [];
  const lanes: DetectionLane[] = [];

  for (const detection of sorted) {
    let laneIndex = laneEnds.findIndex((laneEnd) => laneEnd <= detection.start_utc);

    if (laneIndex === -1) {
      laneIndex = laneEnds.length;
      laneEnds.push(detection.end_utc);
    } else {
      laneEnds[laneIndex] = detection.end_utc;
    }

    lanes.push({ detection, lane: laneIndex });
  }

  return lanes;
}

export function getVisibleVocalizationWindows(
  labels: VocalizationLabel[],
  range: TimeRange,
): VocalizationWindow[] {
  const windows = new Map<string, VocalizationWindow>();

  for (const label of labels) {
    if (label.end_utc < range.start || label.start_utc > range.end) {
      continue;
    }

    const key = `${label.start_utc}:${label.end_utc}`;
    const existing = windows.get(key);

    if (existing) {
      existing.labels.push(label);
    } else {
      windows.set(key, {
        key,
        start: label.start_utc,
        end: label.end_utc,
        labels: [label],
      });
    }
  }

  return [...windows.values()].sort((left, right) => left.start - right.start);
}

export function getTimeTicks(range: TimeRange, zoom: ZoomLevel): number[] {
  const step = TICK_STEPS[zoom];
  const firstTick = Math.ceil(range.start / step) * step;
  const ticks: number[] = [];

  for (let value = firstTick; value < range.end; value += step) {
    ticks.push(value);
  }

  return ticks;
}

export function formatAxisTimestamp(timestamp: number, zoom: ZoomLevel): string {
  const date = new Date(timestamp * 1000);

  if (zoom === "24h" || zoom === "6h") {
    return new Intl.DateTimeFormat("en-US", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }).format(date);
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
}

export function formatUtcTimestamp(timestamp: number): string {
  return `${new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(timestamp * 1000))} UTC`;
}

export function formatTimelineSpan(start: number, end: number): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });

  return `${formatter.format(new Date(start * 1000))} - ${formatter.format(
    new Date(end * 1000),
  )} UTC`;
}

export function formatTimelineCardDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(timestamp * 1000));
}

export function formatDurationShort(seconds: number): string {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainderSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${remainderSeconds}s`;
  }

  return `${remainderSeconds}s`;
}

export function formatSpeciesLabel(species: string): string {
  return species
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(" ");
}

export function getPanStepSeconds(zoom: ZoomLevel): number {
  return Math.max(5, Math.round(VIEWPORT_SPANS[zoom] * 0.1));
}

export function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function deriveTimelineTitle(entry: TimelineEntry): string {
  return `${entry.hydrophone_name} / ${formatSpeciesLabel(entry.species)}`;
}
