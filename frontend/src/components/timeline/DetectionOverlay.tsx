import { useState } from "react";
import type { Detection } from "../../lib/timeline-contract.js";
import type { DetectionLane, TimeRange } from "../../lib/timeline-math.js";
import { clampPercent, timeToPixel } from "../../lib/timeline-math.js";

interface DetectionOverlayProps {
  lanes: DetectionLane[];
  range: TimeRange;
  width: number;
}

const LABEL_COLORS: Record<string, string> = {
  humpback: "#f0a449",
  orca: "#4fa0ff",
  ship: "#ef5a5a",
  background: "#8c97a8",
};

function detectionColor(detection: Detection): string {
  if (detection.label) {
    return LABEL_COLORS[detection.label] ?? "#7fd6bc";
  }

  const alpha = 0.18 + detection.avg_confidence * 0.52;
  return `rgba(142, 204, 193, ${alpha.toFixed(3)})`;
}

function formatDetectionMetric(value: number): string {
  return `${Math.round(clampPercent(value * 100))}%`;
}

function formatTooltipLine(label: string | null): string {
  return label ?? "Unlabeled";
}

export function DetectionOverlay({
  lanes,
  range,
  width,
}: DetectionOverlayProps) {
  const [hovered, setHovered] = useState<DetectionLane | null>(null);
  const overlayHeight = 92;
  const laneCount = Math.max(1, lanes.reduce((max, lane) => Math.max(max, lane.lane + 1), 1));
  const laneHeight = Math.max(10, Math.floor((overlayHeight - 8) / laneCount));

  return (
    <div className="timeline-detection-layer">
      <svg width={width} height={overlayHeight} className="timeline-overlay-svg">
        {lanes.map((lane) => {
          const x = timeToPixel(lane.detection.start_utc, range, width);
          const endX = timeToPixel(lane.detection.end_utc, range, width);
          const barWidth = Math.max(3, endX - x);
          const y = 4 + lane.lane * laneHeight;

          return (
            <g key={lane.detection.row_id}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(8, laneHeight - 3)}
                rx={Math.min(6, laneHeight / 2)}
                fill={detectionColor(lane.detection)}
                stroke="rgba(255,255,255,0.18)"
                strokeWidth={1}
                onMouseEnter={() => setHovered(lane)}
                onMouseLeave={() => setHovered((current) => (current === lane ? null : current))}
              />
            </g>
          );
        })}
      </svg>

      {hovered ? (
        <div
          className="timeline-tooltip"
          style={{
            left: `${timeToPixel(hovered.detection.start_utc, range, width)}px`,
            top: `${6 + hovered.lane * laneHeight}px`,
          }}
        >
          <strong>{formatTooltipLine(hovered.detection.label)}</strong>
          <span>
            Avg {formatDetectionMetric(hovered.detection.avg_confidence)} / Peak{" "}
            {formatDetectionMetric(hovered.detection.peak_confidence)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
