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
  { score: 0, color: [52, 71, 34] },
  { score: 0.25, color: [103, 148, 66] },
  { score: 0.5, color: [159, 206, 93] },
  { score: 0.75, color: [201, 232, 107] },
  { score: 1, color: [240, 243, 111] },
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

    const height = 14;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = "rgba(10, 19, 29, 0.92)";
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
        score == null ? "rgba(84, 103, 70, 0.22)" : interpolateColor(score);
      context.fillRect(x, 0, segmentWidth + 1, height);
    }
  }, [confidence, range, startTimestamp, width]);

  return <canvas ref={canvasRef} className="timeline-confidence-strip" />;
}
