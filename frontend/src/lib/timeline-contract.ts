export const ZOOM_LEVELS = ["24h", "6h", "1h", "15m", "5m", "1m"] as const;

export type ZoomLevel = (typeof ZOOM_LEVELS)[number];
export const TIMELINE_VIEW_MODES = [
  "detections",
  "vocalizations",
] as const;
export type TimelineViewMode = (typeof TIMELINE_VIEW_MODES)[number];

export interface TimelineViewDefaults {
  starting_pos?: number;
  zoom_level?: ZoomLevel;
  view_mode?: TimelineViewMode;
}

export interface TimelineIndex {
  timelines: TimelineEntry[];
}

export interface TimelineEntry extends TimelineViewDefaults {
  job_id: string;
  hydrophone_name: string;
  hints?: string;
  species: string;
  start_timestamp: number;
  end_timestamp: number;
}

export interface TimelineManifest {
  version: 1;
  job: JobMetadata;
  tiles: TileMetadata;
  audio: AudioMetadata;
  confidence: ConfidenceData;
  detections: Detection[];
  vocalization_labels: VocalizationLabel[];
  vocalization_types: VocalizationType[];
}

export interface JobMetadata {
  id: string;
  hydrophone_name: string;
  hydrophone_id: string;
  start_timestamp: number;
  end_timestamp: number;
  species: string;
  window_selection: string;
  model_name: string;
  model_version: string;
}

export interface TileMetadata {
  zoom_levels: ZoomLevel[];
  tile_size: [number, number];
  tile_durations: Record<ZoomLevel, number>;
  tile_counts: Record<ZoomLevel, number>;
}

export interface AudioMetadata {
  chunk_duration_sec: number;
  chunk_count: number;
  format: "mp3";
  sample_rate: number;
}

export interface ConfidenceData {
  window_sec: number;
  scores: Array<number | null>;
}

export interface Detection {
  row_id: string;
  start_utc: number;
  end_utc: number;
  avg_confidence: number;
  peak_confidence: number;
  label: string | null;
}

export interface VocalizationLabel {
  start_utc: number;
  end_utc: number;
  type: string;
  confidence: number;
  source: "manual" | "inference";
}

export interface VocalizationType {
  id: number | string;
  name: string;
}

export const VIEWPORT_SPANS: Record<ZoomLevel, number> = {
  "24h": 86400,
  "6h": 21600,
  "1h": 3600,
  "15m": 900,
  "5m": 300,
  "1m": 60,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isIntegerNumber(value: unknown): value is number {
  return isNumber(value) && Number.isInteger(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isUuid(value: unknown): value is string {
  return (
    isString(value) &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function isZoomLevel(value: unknown): value is ZoomLevel {
  return isString(value) && ZOOM_LEVELS.includes(value as ZoomLevel);
}

function isTimelineViewMode(value: unknown): value is TimelineViewMode {
  return (
    isString(value) &&
    TIMELINE_VIEW_MODES.includes(value as TimelineViewMode)
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isTimelineEntry(value: unknown): value is TimelineEntry {
  if (!isRecord(value)) {
    return false;
  }

  const startTimestamp = value["start_timestamp"];
  const endTimestamp = value["end_timestamp"];
  const startingPos = value["starting_pos"];

  return (
    isUuid(value["job_id"]) &&
    isString(value["hydrophone_name"]) &&
    (value["hints"] === undefined || isString(value["hints"])) &&
    isString(value["species"]) &&
    isNumber(startTimestamp) &&
    isNumber(endTimestamp) &&
    (startingPos === undefined ||
      (isIntegerNumber(startingPos) &&
        startingPos >= startTimestamp &&
        startingPos <= endTimestamp)) &&
    (value["zoom_level"] === undefined || isZoomLevel(value["zoom_level"])) &&
    (value["view_mode"] === undefined ||
      isTimelineViewMode(value["view_mode"]))
  );
}

export function isTimelineIndex(value: unknown): value is TimelineIndex {
  return (
    isRecord(value) &&
    Array.isArray(value["timelines"]) &&
    value["timelines"].every(isTimelineEntry)
  );
}

export function findTimelineEntry(
  index: TimelineIndex,
  jobId: string,
): TimelineEntry | undefined {
  return index.timelines.find((timeline) => timeline.job_id === jobId);
}

function isTileMetadata(value: unknown): value is TileMetadata {
  if (!isRecord(value)) {
    return false;
  }

  const zoomLevels = value["zoom_levels"];
  const tileSize = value["tile_size"];
  const tileDurations = value["tile_durations"];
  const tileCounts = value["tile_counts"];

  return (
    Array.isArray(zoomLevels) &&
    zoomLevels.every(isZoomLevel) &&
    Array.isArray(tileSize) &&
    tileSize.length === 2 &&
    tileSize.every(isNumber) &&
    isRecord(tileDurations) &&
    isRecord(tileCounts) &&
    ZOOM_LEVELS.every(
      (zoom) => isNumber(tileDurations[zoom]) && isNumber(tileCounts[zoom]),
    )
  );
}

function isAudioMetadata(value: unknown): value is AudioMetadata {
  return (
    isRecord(value) &&
    isNumber(value["chunk_duration_sec"]) &&
    isNumber(value["chunk_count"]) &&
    value["format"] === "mp3" &&
    isNumber(value["sample_rate"])
  );
}

function isConfidenceData(value: unknown): value is ConfidenceData {
  return (
    isRecord(value) &&
    isNumber(value["window_sec"]) &&
    Array.isArray(value["scores"]) &&
    value["scores"].every((score) => score === null || isNumber(score))
  );
}

function isDetection(value: unknown): value is Detection {
  return (
    isRecord(value) &&
    isString(value["row_id"]) &&
    isNumber(value["start_utc"]) &&
    isNumber(value["end_utc"]) &&
    isNumber(value["avg_confidence"]) &&
    isNumber(value["peak_confidence"]) &&
    (value["label"] === null || isString(value["label"]))
  );
}

function isVocalizationLabel(value: unknown): value is VocalizationLabel {
  return (
    isRecord(value) &&
    isNumber(value["start_utc"]) &&
    isNumber(value["end_utc"]) &&
    isString(value["type"]) &&
    isNumber(value["confidence"]) &&
    (value["source"] === "manual" || value["source"] === "inference")
  );
}

function isVocalizationType(value: unknown): value is VocalizationType {
  return (
    isRecord(value) &&
    (isNumber(value["id"]) || isString(value["id"])) &&
    isString(value["name"])
  );
}

function isJobMetadata(value: unknown): value is JobMetadata {
  return (
    isRecord(value) &&
    isUuid(value["id"]) &&
    isString(value["hydrophone_name"]) &&
    isString(value["hydrophone_id"]) &&
    isNumber(value["start_timestamp"]) &&
    isNumber(value["end_timestamp"]) &&
    isString(value["species"]) &&
    isString(value["window_selection"]) &&
    isString(value["model_name"]) &&
    isString(value["model_version"])
  );
}

export function isTimelineManifest(value: unknown): value is TimelineManifest {
  return (
    isRecord(value) &&
    value["version"] === 1 &&
    isJobMetadata(value["job"]) &&
    isTileMetadata(value["tiles"]) &&
    isAudioMetadata(value["audio"]) &&
    isConfidenceData(value["confidence"]) &&
    Array.isArray(value["detections"]) &&
    value["detections"].every(isDetection) &&
    Array.isArray(value["vocalization_labels"]) &&
    value["vocalization_labels"].every(isVocalizationLabel) &&
    Array.isArray(value["vocalization_types"]) &&
    value["vocalization_types"].every(isVocalizationType)
  );
}

export function tilePath(jobId: string, zoom: ZoomLevel, index: number): string {
  return `/data/${jobId}/tiles/${zoom}/tile_${String(index).padStart(4, "0")}.png`;
}

export function audioChunkPath(jobId: string, index: number): string {
  return `/data/${jobId}/audio/chunk_${String(index).padStart(4, "0")}.mp3`;
}

export function tileTimeRange(
  manifest: TimelineManifest,
  zoom: ZoomLevel,
  index: number,
) {
  const duration = manifest.tiles.tile_durations[zoom];
  const start = manifest.job.start_timestamp + index * duration;
  const end = Math.min(start + duration, manifest.job.end_timestamp);
  return { start, end };
}

export function chunkTimeRange(manifest: TimelineManifest, index: number) {
  const duration = manifest.audio.chunk_duration_sec;
  const start = manifest.job.start_timestamp + index * duration;
  const end = Math.min(start + duration, manifest.job.end_timestamp);
  return { start, end };
}

export function chunkForTimestamp(
  manifest: TimelineManifest,
  timestamp: number,
): number {
  const offset = Math.max(0, timestamp - manifest.job.start_timestamp);
  return Math.min(
    manifest.audio.chunk_count - 1,
    Math.floor(offset / manifest.audio.chunk_duration_sec),
  );
}

export function defaultZoomForDuration(durationSec: number): ZoomLevel {
  if (durationSec <= VIEWPORT_SPANS["1m"]) {
    return "1m";
  }
  if (durationSec <= VIEWPORT_SPANS["5m"]) {
    return "5m";
  }
  if (durationSec <= VIEWPORT_SPANS["15m"]) {
    return "15m";
  }
  if (durationSec <= VIEWPORT_SPANS["1h"]) {
    return "1h";
  }
  if (durationSec <= VIEWPORT_SPANS["6h"]) {
    return "6h";
  }
  return "24h";
}

export function manifestDuration(manifest: TimelineManifest): number {
  return manifest.job.end_timestamp - manifest.job.start_timestamp;
}

export function supportsZoom(manifest: TimelineManifest, zoom: ZoomLevel): boolean {
  return manifest.tiles.zoom_levels.includes(zoom);
}

export function availableZoomLevels(manifest: TimelineManifest): ZoomLevel[] {
  return ZOOM_LEVELS.filter((zoom) => supportsZoom(manifest, zoom));
}

export function preferredInitialZoom(
  manifest: TimelineManifest,
  targetZoom: ZoomLevel = "1h",
): ZoomLevel {
  const available = availableZoomLevels(manifest);

  if (available.length === 0) {
    return targetZoom;
  }

  return available.reduce((best, current) => {
    const bestDistance = Math.abs(VIEWPORT_SPANS[best] - VIEWPORT_SPANS[targetZoom]);
    const currentDistance = Math.abs(
      VIEWPORT_SPANS[current] - VIEWPORT_SPANS[targetZoom],
    );

    return currentDistance < bestDistance ? current : best;
  });
}

export function supportedManifestVersion(value: unknown): value is 1 {
  return value === 1;
}

export function isHydrophoneFriendlyId(value: unknown): value is string {
  return isString(value) && value.length > 0;
}

export function isStringList(value: unknown): value is string[] {
  return isStringArray(value);
}
