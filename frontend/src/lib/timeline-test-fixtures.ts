import type { TimelineEntry, TimelineManifest } from "./timeline-contract.js";

const sampleJobId = "550e8400-e29b-41d4-a716-446655440000";

export const sampleTimelineEntry: TimelineEntry = {
  job_id: sampleJobId,
  hydrophone_name: "Orcasound Lab",
  species: "ar-v2-promoted",
  start_timestamp: 1_711_929_600,
  end_timestamp: 1_711_936_800,
};

export const sampleTimelineManifest: TimelineManifest = {
  version: 1,
  job: {
    id: sampleJobId,
    hydrophone_name: "Orcasound Lab",
    hydrophone_id: "orcasound-lab",
    start_timestamp: 1_711_929_600,
    end_timestamp: 1_711_936_800,
    species: "ar-v2-promoted",
    window_selection: "full-day",
    model_name: "ar-v2",
    model_version: "promoted",
  },
  tiles: {
    zoom_levels: ["24h", "6h", "1h", "15m", "5m", "1m"],
    tile_size: [2048, 512],
    tile_durations: {
      "24h": 86_400,
      "6h": 21_600,
      "1h": 3_600,
      "15m": 900,
      "5m": 300,
      "1m": 60,
    },
    tile_counts: {
      "24h": 1,
      "6h": 1,
      "1h": 2,
      "15m": 8,
      "5m": 24,
      "1m": 120,
    },
  },
  audio: {
    chunk_duration_sec: 300,
    chunk_count: 24,
    format: "mp3",
    sample_rate: 48_000,
  },
  confidence: {
    window_sec: 5,
    scores: [0.2, 0.45, null, 0.92, 0.61],
  },
  detections: [
    {
      row_id: "detection-1",
      start_utc: 1_711_929_660,
      end_utc: 1_711_929_720,
      avg_confidence: 0.74,
      peak_confidence: 0.91,
      label: "song",
    },
    {
      row_id: "detection-2",
      start_utc: 1_711_929_700,
      end_utc: 1_711_929_800,
      avg_confidence: 0.68,
      peak_confidence: 0.87,
      label: "call",
    },
    {
      row_id: "detection-3",
      start_utc: 1_711_929_820,
      end_utc: 1_711_929_880,
      avg_confidence: 0.51,
      peak_confidence: 0.63,
      label: null,
    },
  ],
  vocalization_labels: [
    {
      start_utc: 1_711_930_000,
      end_utc: 1_711_930_060,
      type: "moan",
      confidence: 0.9,
      source: "manual",
    },
    {
      start_utc: 1_711_930_000,
      end_utc: 1_711_930_060,
      type: "whistle",
      confidence: 0.62,
      source: "inference",
    },
    {
      start_utc: 1_711_930_600,
      end_utc: 1_711_930_660,
      type: "burst pulse",
      confidence: 0.55,
      source: "inference",
    },
  ],
  vocalization_types: [
    {
      id: "1d4df6f5-76dd-4c08-8d16-3ca5ca7437da",
      name: "moan",
    },
    {
      id: 2,
      name: "whistle",
    },
  ],
};
