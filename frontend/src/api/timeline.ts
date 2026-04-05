import {
  isTimelineIndex,
  isTimelineManifest,
  supportedManifestVersion,
  type TimelineIndex,
  type TimelineManifest,
} from "../lib/timeline-contract.js";
import {
  MissingTimelineDataError,
  TimelineDataError,
  UnsupportedManifestVersionError,
} from "../lib/timeline-errors.js";

async function fetchJson(path: string): Promise<unknown> {
  const response = await fetch(path, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new TimelineDataError(
        `Timeline data was not found at ${path}. In local development, make sure TIMELINE_EXPORT_ROOT points at a directory containing /data/index.json and job folders.`,
      );
    }

    throw new TimelineDataError(
      `Failed to load timeline data from ${path} (${response.status} ${response.statusText}).`,
    );
  }

  return response.json();
}

export async function fetchTimelineIndex(): Promise<TimelineIndex> {
  const payload = await fetchJson("/data/index.json");

  if (!isTimelineIndex(payload)) {
    throw new MissingTimelineDataError(
      "The timeline index is present but does not match the expected contract.",
    );
  }

  return payload;
}

export async function fetchTimelineManifest(
  jobId: string,
): Promise<TimelineManifest> {
  const payload = await fetchJson(`/data/${encodeURIComponent(jobId)}/manifest.json`);

  if (
    typeof payload === "object" &&
    payload !== null &&
    "version" in payload &&
    !supportedManifestVersion((payload as { version?: unknown }).version)
  ) {
    throw new UnsupportedManifestVersionError(
      (payload as { version?: unknown }).version,
    );
  }

  if (!isTimelineManifest(payload)) {
    throw new MissingTimelineDataError(
      `The timeline manifest for ${jobId} is present but does not match the expected contract.`,
    );
  }

  return payload;
}
