import { useEffect, useRef } from "react";
import type { ConfidenceData } from "../../lib/timeline-contract.js";
import type { TimeRange } from "../../lib/timeline-math.js";
import { timeToPixel } from "../../lib/timeline-math.js";

interface ConfidenceStripProps {
  confidence: ConfidenceData;
  range: TimeRange;
  startTimestamp: number;
  width: number;
}

const GRADIENT_STOPS = [
  { score: 0, color: [26, 26, 46] },
  { score: 0.15, color: [22, 33, 62] },
  { score: 0.3, color: [15, 52, 96] },
  { score: 0.45, color: [45, 106, 79] },
  { score: 0.6, color: [82, 183, 136] },
  { score: 0.75, color: [149, 213, 178] },
  { score: 0.85, color: [244, 211, 94] },
  { score: 1, color: [249, 229, 71] },
] as const;

function interpolateColor(score: number): string {
  const clamped = Math.max(0, Math.min(1, score));

  for (let index = 0; index < GRADIENT_STOPS.length - 1; index += 1) {
    const left = GRADIENT_STOPS[index]!;
    const right = GRADIENT_STOPS[index + 1]!;

    if (clamped >= left.score && clamped <= right.score) {
      const span = right.score - left.score || 1;
      const progress = (clamped - left.score) / span;
      const [r1, g1, b1] = left.color;
      const [r2, g2, b2] = right.color;
      const r = Math.round(r1 + (r2 - r1) * progress);
      const g = Math.round(g1 + (g2 - g1) * progress);
      const b = Math.round(b1 + (b2 - b1) * progress);
      return `rgb(${r}, ${g}, ${b})`;
    }
  }

  const last = GRADIENT_STOPS[GRADIENT_STOPS.length - 1]!;
  return `rgb(${last.color[0]}, ${last.color[1]}, ${last.color[2]})`;
}

export function ConfidenceStrip({
  confidence,
  range,
  startTimestamp,
  width,
}: ConfidenceStripProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0) {
      return;
    }

    const height = 22;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = "rgba(20, 34, 54, 0.9)";
    context.fillRect(0, 0, width, height);

    const windowSeconds = confidence.window_sec;
    const startIndex = Math.max(
      0,
      Math.floor((range.start - startTimestamp) / windowSeconds),
    );
    const endIndex = Math.min(
      confidence.scores.length - 1,
      Math.ceil((range.end - startTimestamp) / windowSeconds),
    );

    for (let index = startIndex; index <= endIndex; index += 1) {
      const score = confidence.scores[index];
      const segmentStart = startTimestamp + index * windowSeconds;
      const segmentEnd = segmentStart + windowSeconds;
      const x = timeToPixel(segmentStart, range, width);
      const nextX = timeToPixel(segmentEnd, range, width);
      const segmentWidth = Math.max(1, nextX - x);

      context.fillStyle =
        score == null ? "rgba(90, 122, 150, 0.14)" : interpolateColor(score);
      context.fillRect(x, 0, segmentWidth + 1, height);
    }
  }, [confidence, range, startTimestamp, width]);

  return <canvas ref={canvasRef} className="timeline-confidence-strip" />;
}
