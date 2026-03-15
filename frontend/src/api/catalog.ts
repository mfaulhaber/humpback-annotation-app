import type {
  ListFoldersResponse,
  ListSamplesResponse,
  GetSampleResponse,
} from "@humpback/api";
import { apiFetch } from "./client.js";

export async function fetchFolders(
  cursor?: string,
): Promise<ListFoldersResponse> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  const qs = params.toString();
  return apiFetch<ListFoldersResponse>(`/api/folders${qs ? `?${qs}` : ""}`);
}

export async function fetchSamples(
  folderId: string,
  opts?: { cursor?: string | undefined; limit?: number | undefined; filter?: string | undefined },
): Promise<ListSamplesResponse> {
  const params = new URLSearchParams();
  if (opts?.cursor) params.set("cursor", opts.cursor);
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.filter) params.set("filter", opts.filter);
  const qs = params.toString();
  return apiFetch<ListSamplesResponse>(
    `/api/folders/${folderId}/samples${qs ? `?${qs}` : ""}`,
  );
}

export async function fetchSample(
  sampleId: string,
): Promise<GetSampleResponse> {
  return apiFetch<GetSampleResponse>(`/api/samples/${sampleId}`);
}
