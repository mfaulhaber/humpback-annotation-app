import { useState } from "react";
import { LABEL_CATEGORIES } from "@humpback/api";
import type { LabelCategory, SubmitLabelResponse } from "@humpback/api";
import { submitLabel } from "../api/annotation.js";

interface LabelFormProps {
  sampleId: string;
  currentLabel?: LabelCategory | undefined;
  onLabeled: (result: SubmitLabelResponse) => void;
}

export function LabelForm({ sampleId, currentLabel, onLabeled }: LabelFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(category: LabelCategory) {
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitLabel(sampleId, category);
      onLabeled(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit label");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 8,
        padding: 16,
        border: "1px solid #e0e0e0",
        marginBottom: 16,
      }}
    >
      <h3 style={{ marginBottom: 8 }}>
        {currentLabel ? "Your Label" : "Submit Label"}
      </h3>
      {currentLabel && (
        <p style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>
          Current: <strong>{currentLabel}</strong> (click another to relabel)
        </p>
      )}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
        }}
      >
        {LABEL_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => void handleSubmit(cat)}
            disabled={submitting}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: cat === currentLabel ? "2px solid #1a1a2e" : "1px solid #ccc",
              background: cat === currentLabel ? "#e8e8f0" : "#fff",
              fontWeight: cat === currentLabel ? 600 : 400,
              cursor: submitting ? "wait" : "pointer",
              fontSize: 13,
            }}
          >
            {cat}
          </button>
        ))}
      </div>
      {error && (
        <p style={{ color: "crimson", fontSize: 13, marginTop: 8 }}>{error}</p>
      )}
    </div>
  );
}
