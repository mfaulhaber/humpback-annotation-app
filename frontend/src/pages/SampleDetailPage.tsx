import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { GetSampleResponse, LabelCategory, SubmitLabelResponse } from "@humpback/api";
import { fetchSample } from "../api/catalog.js";
import { LabelForm } from "../components/LabelForm.js";
import { AggregateDisplay } from "../components/AggregateDisplay.js";

export function SampleDetailPage() {
  const { sampleId } = useParams<{ sampleId: string }>();
  const [data, setData] = useState<GetSampleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sampleId) return;
    setLoading(true);
    fetchSample(sampleId)
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load sample"),
      )
      .finally(() => setLoading(false));
  }, [sampleId]);

  function handleLabeled(result: SubmitLabelResponse) {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        userLabel: result.userLabel,
        aggregate: result.aggregate,
      };
    });
  }

  if (loading) return <p style={{ padding: 24 }}>Loading sample...</p>;
  if (error) return <p style={{ padding: 24, color: "crimson" }}>{error}</p>;
  if (!data) return <p style={{ padding: 24 }}>Sample not found.</p>;

  const { sample } = data;

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <Link
        to={`/folders/${sample.folderId}`}
        style={{ color: "#555", fontSize: 14 }}
      >
        &larr; Back to samples
      </Link>

      <h1 style={{ marginTop: 8, marginBottom: 16 }}>{sample.sampleId}</h1>

      {/* Spectrogram */}
      {sample.spectrogramUrl ? (
        <div
          style={{
            background: "#fff",
            borderRadius: 8,
            overflow: "hidden",
            border: "1px solid #e0e0e0",
            marginBottom: 16,
          }}
        >
          <img
            src={sample.spectrogramUrl}
            alt="spectrogram"
            style={{ width: "100%", display: "block" }}
          />
        </div>
      ) : (
        <div
          style={{
            background: "#f5f5f5",
            borderRadius: 8,
            padding: 32,
            textAlign: "center",
            border: "1px dashed #ccc",
            marginBottom: 16,
            color: "#999",
          }}
        >
          No spectrogram available for this sample.
        </div>
      )}

      {/* Audio player */}
      <div
        style={{
          background: "#fff",
          borderRadius: 8,
          padding: 16,
          border: "1px solid #e0e0e0",
          marginBottom: 16,
        }}
      >
        <h3 style={{ marginBottom: 8 }}>Audio</h3>
        <audio controls style={{ width: "100%" }}>
          <source src={sample.audioUrl} />
        </audio>
      </div>

      {/* Metadata */}
      <div
        style={{
          background: "#fff",
          borderRadius: 8,
          padding: 16,
          border: "1px solid #e0e0e0",
          marginBottom: 16,
        }}
      >
        <h3 style={{ marginBottom: 8 }}>Details</h3>
        <table style={{ fontSize: 14 }}>
          <tbody>
            <tr>
              <td style={{ paddingRight: 16, color: "#666" }}>Captured</td>
              <td>{new Date(sample.capturedAt).toLocaleString()}</td>
            </tr>
            <tr>
              <td style={{ paddingRight: 16, color: "#666" }}>Duration</td>
              <td>{sample.durationSec}s</td>
            </tr>
            <tr>
              <td style={{ paddingRight: 16, color: "#666" }}>Source</td>
              <td>{sample.sourceRecordingId}</td>
            </tr>
            <tr>
              <td style={{ paddingRight: 16, color: "#666" }}>Folder</td>
              <td>{sample.folderId}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Label form */}
      <LabelForm
        sampleId={sample.sampleId}
        currentLabel={data.userLabel}
        onLabeled={handleLabeled}
      />

      {/* Aggregate display */}
      {data.aggregate ? (
        <AggregateDisplay
          totalLabels={data.aggregate.totalLabels}
          percentagesByCategory={data.aggregate.percentagesByCategory}
        />
      ) : (
        <div
          style={{
            background: "#fff",
            borderRadius: 8,
            padding: 16,
            border: "1px dashed #ccc",
            color: "#999",
            textAlign: "center",
            fontSize: 14,
          }}
        >
          Submit your label to see aggregate results.
        </div>
      )}
    </div>
  );
}
