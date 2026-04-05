import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchTimelineIndex } from "../api/timeline.js";
import { TimelineLayout } from "../components/timeline/TimelineLayout.js";
import type { TimelineEntry } from "../lib/timeline-contract.js";
import {
  deriveTimelineTitle,
  formatDurationShort,
  formatSpeciesLabel,
  formatTimelineCardDate,
} from "../lib/timeline-math.js";

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
          <div className="timeline-kicker">Timeline Viewer MVP</div>
          <h1>Browse exported acoustic timelines without the annotation workflow in front.</h1>
          <p>
            The active app surface now opens same-origin exported jobs from
            static `/data/*` artifacts, locally and through CloudFront-backed
            S3.
          </p>
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
              const duration = timeline.end_timestamp - timeline.start_timestamp;

              return (
                <Link
                  key={timeline.job_id}
                  to={`/${timeline.job_id}`}
                  className="timeline-card"
                >
                  <div className="timeline-card__meta">
                    <span className="timeline-card__species">
                      {formatSpeciesLabel(timeline.species)}
                    </span>
                    <span className="timeline-card__duration">
                      {formatDurationShort(duration)}
                    </span>
                  </div>
                  <h2>{deriveTimelineTitle(timeline)}</h2>
                  <p className="timeline-card__date-range">
                    {formatTimelineCardDate(timeline.start_timestamp)}
                    {" -> "}
                    {formatTimelineCardDate(timeline.end_timestamp)}
                  </p>
                  <span className="timeline-card__cta">Open timeline</span>
                </Link>
              );
            })}
          </section>
        ) : null}
      </div>
    </TimelineLayout>
  );
}
