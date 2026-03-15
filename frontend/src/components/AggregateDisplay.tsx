interface AggregateDisplayProps {
  totalLabels: number;
  percentagesByCategory: Record<string, number>;
}

export function AggregateDisplay({
  totalLabels,
  percentagesByCategory,
}: AggregateDisplayProps) {
  const sorted = Object.entries(percentagesByCategory).sort(
    ([, a], [, b]) => b - a,
  );

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
        Aggregate ({totalLabels} label{totalLabels !== 1 ? "s" : ""})
      </h3>
      <div style={{ display: "grid", gap: 6 }}>
        {sorted.map(([category, pct]) => (
          <div key={category}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                marginBottom: 2,
              }}
            >
              <span>{category}</span>
              <span style={{ color: "#666" }}>{pct}%</span>
            </div>
            <div
              style={{
                height: 8,
                background: "#eee",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: "#1a1a2e",
                  borderRadius: 4,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
