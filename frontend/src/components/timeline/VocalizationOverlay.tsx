import type { VocalizationType } from "../../lib/timeline-contract.js";
import type { TimeRange, VocalizationWindow } from "../../lib/timeline-math.js";
import { timeToPixel } from "../../lib/timeline-math.js";

interface VocalizationOverlayProps {
  windows: VocalizationWindow[];
  range: TimeRange;
  types: VocalizationType[];
  width: number;
}

const PALETTE = [
  "#52b788",
  "#4ea8de",
  "#f4a261",
  "#e76f51",
  "#f6bd60",
  "#c77dff",
  "#90be6d",
  "#f28482",
  "#84a59d",
  "#f5cac3",
];

export function VocalizationOverlay({
  windows,
  range,
  types,
  width,
}: VocalizationOverlayProps) {
  const colorByType = new Map<string, string>();
  types.forEach((entry, index) => {
    colorByType.set(entry.name, PALETTE[index % PALETTE.length]!);
  });

  return (
    <div className="timeline-vocalization-layer">
      {windows.map((window, index) => {
        const left = timeToPixel(window.start, range, width);
        const right = timeToPixel(window.end, range, width);
        const chipRow = index % 4;

        return (
          <div
            key={window.key}
            className="timeline-vocalization-window"
            style={{
              left: `${Math.max(0, left)}px`,
              top: `${8 + chipRow * 28}px`,
              width: `${Math.max(12, right - left)}px`,
            }}
          >
            {window.labels.map((label) => {
              const color = colorByType.get(label.type) ?? "#7fd6bc";

              return (
                <span
                  key={`${window.key}:${label.type}:${label.source}`}
                  className={`timeline-vocalization-chip timeline-vocalization-chip--${label.source}`}
                  style={{
                    borderColor: color,
                    background:
                      label.source === "manual" ? `${color}22` : "rgba(13, 25, 40, 0.88)",
                    color,
                  }}
                >
                  {label.type}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
