import type { LabelCategory } from "../types/labels.js";

export function computePercentages(
  countsByCategory: Partial<Record<LabelCategory, number>>,
  totalLabels: number,
): Record<string, number> {
  if (totalLabels === 0) return {};

  const result: Record<string, number> = {};
  for (const [category, count] of Object.entries(countsByCategory)) {
    if (count != null && count > 0) {
      result[category] = Math.round((count / totalLabels) * 1000) / 10;
    }
  }
  return result;
}
