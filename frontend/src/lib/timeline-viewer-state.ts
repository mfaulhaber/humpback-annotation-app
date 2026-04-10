import {
  preferredInitialZoom,
  type TimelineManifest,
  type TimelineViewDefaults,
  type TimelineViewMode,
  type ZoomLevel,
} from "./timeline-contract.js";
import {
  clampTimestamp,
  initialTimelineCenterTimestamp,
} from "./timeline-math.js";

const PLAYBACK_SYNC_EPSILON = 0.001;

export type TimelineOverlayMode = "none" | TimelineViewMode;

export interface InitialTimelineViewState {
  centerTimestamp: number;
  overlayMode: TimelineViewMode;
  zoom: ZoomLevel;
}

export function buildTimelineViewerHref(
  jobId: string,
  defaults?: TimelineViewDefaults,
): string {
  const searchParams = new URLSearchParams();

  if (defaults?.starting_pos !== undefined) {
    searchParams.set("starting_pos", String(defaults.starting_pos));
  }

  if (defaults?.zoom_level !== undefined) {
    searchParams.set("zoom_level", defaults.zoom_level);
  }

  if (defaults?.view_mode !== undefined) {
    searchParams.set("view_mode", defaults.view_mode);
  }

  const search = searchParams.toString();
  return search.length > 0 ? `/${jobId}?${search}` : `/${jobId}`;
}

export function parseTimelineViewSearchParams(
  searchParams: URLSearchParams,
): TimelineViewDefaults {
  const defaults: TimelineViewDefaults = {};
  const startingPos = searchParams.get("starting_pos");
  const zoomLevel = searchParams.get("zoom_level");
  const viewMode = searchParams.get("view_mode");

  if (startingPos !== null && /^-?\d+$/.test(startingPos)) {
    const parsed = Number(startingPos);

    if (Number.isSafeInteger(parsed)) {
      defaults.starting_pos = parsed;
    }
  }

  if (zoomLevel === "24h" || zoomLevel === "6h" || zoomLevel === "1h" ||
    zoomLevel === "15m" || zoomLevel === "5m" || zoomLevel === "1m") {
    defaults.zoom_level = zoomLevel;
  }

  if (viewMode === "detections" || viewMode === "vocalizations") {
    defaults.view_mode = viewMode;
  }

  return defaults;
}

export function mergeTimelineViewDefaults(
  baseDefaults?: TimelineViewDefaults,
  overrideDefaults?: TimelineViewDefaults,
): TimelineViewDefaults {
  const mergedDefaults: TimelineViewDefaults = {};
  const startingPos =
    overrideDefaults?.starting_pos ?? baseDefaults?.starting_pos;
  const viewMode = overrideDefaults?.view_mode ?? baseDefaults?.view_mode;
  const zoomLevel = overrideDefaults?.zoom_level ?? baseDefaults?.zoom_level;

  if (startingPos !== undefined) {
    mergedDefaults.starting_pos = startingPos;
  }

  if (viewMode !== undefined) {
    mergedDefaults.view_mode = viewMode;
  }

  if (zoomLevel !== undefined) {
    mergedDefaults.zoom_level = zoomLevel;
  }

  return mergedDefaults;
}

export function resolveInitialTimelineViewState(
  manifest: TimelineManifest,
  defaults?: TimelineViewDefaults,
): InitialTimelineViewState {
  return {
    centerTimestamp: clampTimestamp(
      manifest,
      defaults?.starting_pos ?? initialTimelineCenterTimestamp(manifest),
    ),
    overlayMode: defaults?.view_mode ?? "detections",
    zoom: defaults?.zoom_level
      ? preferredInitialZoom(manifest, defaults.zoom_level)
      : preferredInitialZoom(manifest, "1h"),
  };
}

export function shouldSyncCenterTimestampFromPlayback(
  centerTimestamp: number,
  playbackTimestamp: number,
  isPlaying: boolean,
  isViewportInteracting = false,
): boolean {
  return (
    isPlaying &&
    !isViewportInteracting &&
    Math.abs(playbackTimestamp - centerTimestamp) > PLAYBACK_SYNC_EPSILON
  );
}

export function getOverlayVisibility(mode: TimelineOverlayMode): {
  showDetections: boolean;
  showVocalizations: boolean;
} {
  return {
    showDetections: mode === "detections",
    showVocalizations: mode === "vocalizations",
  };
}

export function toggleOverlayMode(
  currentMode: TimelineOverlayMode,
  requestedMode: Exclude<TimelineOverlayMode, "none">,
): TimelineOverlayMode {
  return currentMode === requestedMode ? "none" : requestedMode;
}
