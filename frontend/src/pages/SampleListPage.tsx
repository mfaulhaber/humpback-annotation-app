import { useEffect, useState, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import type { SampleRef } from "@humpback/api";
import { fetchSamples } from "../api/catalog.js";
import { fetchSuggestNext } from "../api/suggestion.js";

type SampleWithLabel = SampleRef & { isLabeledByUser?: boolean };
type FilterMode = "all" | "labeled" | "unlabeled";

export function SampleListPage() {
  const { folderId } = useParams<{ folderId: string }>();
  const navigate = useNavigate();
  const [samples, setSamples] = useState<SampleWithLabel[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [suggesting, setSuggesting] = useState(false);

  const load = useCallback(
    async (append = false, nextCursor?: string, activeFilter?: FilterMode) => {
      if (!folderId) return;
      setLoading(true);
      try {
        const res = await fetchSamples(folderId, {
          cursor: nextCursor,
          filter: activeFilter ?? filter,
        });
        setSamples((prev) => (append ? [...prev, ...res.samples] : res.samples));
        setCursor(res.cursor);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load samples");
      } finally {
        setLoading(false);
      }
    },
    [folderId, filter],
  );

  useEffect(() => {
    void load(false, undefined, filter);
  }, [folderId, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleFilterChange(newFilter: FilterMode) {
    setFilter(newFilter);
    setSamples([]);
    setCursor(undefined);
  }

  async function handleSuggestNext() {
    if (!folderId) return;
    setSuggesting(true);
    try {
      const result = await fetchSuggestNext(folderId);
      if (result) {
        navigate(`/samples/${result.sampleId}`);
      } else {
        setError("All samples in this folder have been labeled!");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to get suggestion");
    } finally {
      setSuggesting(false);
    }
  }

  if (error && samples.length === 0) {
    return <p style={{ padding: 24, color: "crimson" }}>{error}</p>;
  }

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ marginBottom: 16 }}>
        <Link to="/" style={{ color: "#555", fontSize: 14 }}>
          &larr; Back to folders
        </Link>
        <h1 style={{ marginTop: 8 }}>Samples in {folderId}</h1>
      </div>

      {/* Controls bar */}
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        {/* Filter toggles */}
        {(["all", "labeled", "unlabeled"] as const).map((f) => (
          <button
            key={f}
            onClick={() => handleFilterChange(f)}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: filter === f ? "2px solid #1a1a2e" : "1px solid #ccc",
              background: filter === f ? "#e8e8f0" : "#fff",
              fontWeight: filter === f ? 600 : 400,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {f}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {/* Suggest next */}
        <button
          onClick={() => void handleSuggestNext()}
          disabled={suggesting}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            border: "1px solid #1a1a2e",
            background: "#1a1a2e",
            color: "#fff",
            cursor: suggesting ? "wait" : "pointer",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {suggesting ? "Finding..." : "Suggest Next"}
        </button>
      </div>

      {error && (
        <p style={{ color: "crimson", fontSize: 13, marginBottom: 12 }}>
          {error}
        </p>
      )}

      {samples.length === 0 && !loading ? (
        <p>No samples found.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 12,
          }}
        >
          {samples.map((s) => (
            <Link
              key={s.sampleId}
              to={`/samples/${s.sampleId}`}
              style={{
                display: "block",
                background: "#fff",
                borderRadius: 8,
                overflow: "hidden",
                textDecoration: "none",
                color: "inherit",
                border: "1px solid #e0e0e0",
              }}
            >
              {s.spectrogramKey ? (
                <img
                  src={`/media/${s.spectrogramKey}`}
                  alt="spectrogram"
                  style={{ width: "100%", height: 100, objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: 100,
                    background: "#e8e8e8",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#999",
                    fontSize: 12,
                  }}
                >
                  No spectrogram
                </div>
              )}
              <div style={{ padding: 8 }}>
                <div
                  style={{
                    fontSize: 12,
                    color: "#666",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>{new Date(s.capturedAt).toLocaleTimeString()}</span>
                  <span>{s.durationSec}s</span>
                </div>
                {s.isLabeledByUser != null && (
                  <span
                    style={{
                      display: "inline-block",
                      marginTop: 4,
                      padding: "2px 6px",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      background: s.isLabeledByUser ? "#d4edda" : "#fff3cd",
                      color: s.isLabeledByUser ? "#155724" : "#856404",
                    }}
                  >
                    {s.isLabeledByUser ? "labeled" : "unlabeled"}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {loading && <p style={{ marginTop: 12 }}>Loading...</p>}

      {cursor && !loading && (
        <button
          onClick={() => void load(true, cursor)}
          style={{
            marginTop: 16,
            padding: "8px 16px",
            cursor: "pointer",
            border: "1px solid #ccc",
            borderRadius: 6,
            background: "#fff",
          }}
        >
          Load more
        </button>
      )}
    </div>
  );
}
