import type { SubmitLabelResponse, LabelCategory } from "@humpback/api";
import { apiFetch } from "./client.js";

export async function submitLabel(
  sampleId: string,
  category: LabelCategory,
): Promise<SubmitLabelResponse> {
  return apiFetch<SubmitLabelResponse>(`/api/samples/${sampleId}/label`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category }),
  });
}
