import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchTimelineIndex } from "../api/timeline.js";
import { TimelineLayout } from "../components/timeline/TimelineLayout.js";
import type { TimelineEntry } from "../lib/timeline-contract.js";
import {
  formatTimelineCardRange,
} from "../lib/timeline-math.js";

const TIMELINE_DESCRIPTION_PARAGRAPHS = [
  "The audio behind these timelines comes from long-running underwater recordings collected by hydrophones, including sources such as Orcasound listening stations and NOAA archive material. Those recordings are processed upstream into reviewable timeline exports so the browser can focus on exploration instead of heavy audio analysis work.",
  "In that upstream pipeline, short slices of audio are turned into acoustic embeddings using Perch or SurfPerch. Those embeddings act as compact summaries of the sound and are used to train a first-pass binary classifier that separates likely whale audio from background noise or other non-whale sounds.",
  "After that whale versus not-whale step, additional classifiers are trained for individual humpback vocalization types. That makes it possible to surface likely detections and likely call labels together, so a reviewer can move through a long recording with much more context than raw audio alone would provide.",
  "The timeline viewer brings those prepared results together in one readonly workspace. You can open a job, zoom between broad and fine time scales, play and pause audio, skip backward or forward, change playback speed, watch the UTC time readout track the playhead, and toggle detections or vocalizations on the timeline while exploring the spectrogram.",
] as const;

export function TimelineIndexPage() {
  const [timelines, setTimelines] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTimelineIndex()
      .then((response) => {
        const sorted = [...response.timelines].sort(
          (left, right) => right.start_timestamp - left.start_timestamp,
        );
        setTimelines(sorted);
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Failed to load the timeline registry.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <TimelineLayout chrome="index">
      <div className="timeline-index">
        <header className="timeline-index__hero">
          <div className="timeline-kicker">Humpback Timeline Viewer</div>
        </header>

        {loading ? (
          <div className="timeline-empty-state">
            <h2>Loading timelines</h2>
            <p>Reading `/data/index.json`...</p>
          </div>
        ) : null}

        {error ? (
          <div className="timeline-empty-state timeline-empty-state--error">
            <h2>Timeline data unavailable</h2>
            <p>{error}</p>
          </div>
        ) : null}

        {!loading && !error && timelines.length === 0 ? (
          <div className="timeline-empty-state">
            <h2>No timelines found</h2>
            <p>
              Add exported artifacts under `/data`, or point
              `TIMELINE_EXPORT_ROOT` at a directory containing `index.json`.
            </p>
          </div>
        ) : null}

        {!loading && !error && timelines.length > 0 ? (
          <section className="timeline-card-grid">
            {timelines.map((timeline) => {
              return (
                <Link
                  key={timeline.job_id}
                  to={`/${timeline.job_id}`}
                  className="timeline-card"
                >
                  <div className="timeline-card__summary">
                    <span className="timeline-card__summary-item">
                      <span className="timeline-card__summary-label">Hydrophone:</span>
                      {timeline.hydrophone_name}
                    </span>
                    <span className="timeline-card__summary-item">
                      <span className="timeline-card__summary-label">Date Range:</span>
                      {formatTimelineCardRange(
                        timeline.start_timestamp,
                        timeline.end_timestamp,
                      )}
                    </span>
                  </div>
                  <span className="timeline-card__cta">Open timeline</span>
                </Link>
              );
            })}
          </section>
        ) : null}

        <footer className="timeline-index__footer" aria-label="Description">
          <h2>Description</h2>
          {TIMELINE_DESCRIPTION_PARAGRAPHS.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </footer>
      </div>
    </TimelineLayout>
  );
}
