import type { SuggestNextResponse } from "@humpback/api";
import { apiFetch } from "./client.js";

export async function fetchSuggestNext(
  folderId: string,
): Promise<SuggestNextResponse | undefined> {
  return apiFetch<SuggestNextResponse | undefined>(
    `/api/samples/suggest-next?folderId=${encodeURIComponent(folderId)}`,
  );
}
