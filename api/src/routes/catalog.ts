import type { FastifyInstance } from "fastify";
import type { Config } from "../config.js";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  listFolders,
  listSamplesInFolder,
  getSampleDetail,
} from "../data/catalog.js";
import {
  batchGetUserLabels,
  getUserLabel,
  getSampleAggregate,
} from "../data/labels.js";
import { resolveMediaUrl } from "../lib/media-url.js";
import { computePercentages } from "../lib/percentages.js";
import type {
  ListFoldersResponse,
  ListSamplesResponse,
  GetSampleResponse,
} from "../types/api.js";
import type { Folder } from "../types/entities.js";
import type { FolderItem, SampleRefItem } from "../types/dynamo.js";

function folderItemToFolder(item: FolderItem): Folder {
  return {
    folderId: item.folder_id,
    name: item.name,
    description: item.description,
    sampleCount: item.sample_count,
    createdAt: item.created_at,
  };
}

export default async function catalogRoutes(
  fastify: FastifyInstance,
  opts: { config: Config; docClient: DynamoDBDocumentClient },
): Promise<void> {
  const { config, docClient } = opts;

  // GET /api/folders
  fastify.get<{
    Querystring: { cursor?: string; limit?: string };
  }>("/api/folders", async (request) => {
    const { cursor, limit } = request.query;
    const result = await listFolders(
      docClient,
      config,
      cursor,
      limit ? parseInt(limit, 10) : undefined,
    );

    const response: ListFoldersResponse = {
      folders: result.items.map(folderItemToFolder),
      ...(result.cursor && { cursor: result.cursor }),
    };
    return response;
  });

  // GET /api/folders/:folderId/samples
  fastify.get<{
    Params: { folderId: string };
    Querystring: {
      cursor?: string;
      limit?: string;
      filter?: "all" | "labeled" | "unlabeled";
    };
  }>("/api/folders/:folderId/samples", async (request) => {
    const { folderId } = request.params;
    const { cursor, limit, filter = "all" } = request.query;
    const pageSize = limit ? parseInt(limit, 10) : 20;

    if (filter === "all") {
      // Simple case: return all samples with label status
      const result = await listSamplesInFolder(
        docClient,
        config,
        folderId,
        cursor,
        pageSize,
      );

      const sampleIds = result.items.map((item) => item.sample_id);
      const labelMap = await batchGetUserLabels(
        docClient,
        config,
        request.userId,
        sampleIds,
      );

      const response: ListSamplesResponse = {
        samples: result.items.map((item: SampleRefItem) => ({
          sampleId: item.sample_id,
          folderId,
          capturedAt: item.captured_at,
          audioKey: item.audio_key,
          spectrogramKey: item.spectrogram_key,
          durationSec: item.duration_sec,
          isActive: item.is_active,
          isLabeledByUser: labelMap.has(item.sample_id),
        })),
        ...(result.cursor && { cursor: result.cursor }),
      };
      return response;
    }

    // Filtered case: over-scan to fill the page
    const collected: (SampleRefItem & { isLabeledByUser: boolean })[] = [];
    let scanCursor: string | undefined = cursor;
    const maxScans = 10; // safety limit

    for (let scan = 0; scan < maxScans && collected.length < pageSize; scan++) {
      const result = await listSamplesInFolder(
        docClient,
        config,
        folderId,
        scanCursor,
        pageSize * 2, // over-scan
      );

      if (result.items.length === 0) {
        scanCursor = undefined;
        break;
      }

      const sampleIds = result.items.map((item) => item.sample_id);
      const labelMap = await batchGetUserLabels(
        docClient,
        config,
        request.userId,
        sampleIds,
      );

      for (const item of result.items) {
        if (collected.length >= pageSize) break;
        const isLabeled = labelMap.has(item.sample_id);
        if (
          (filter === "labeled" && isLabeled) ||
          (filter === "unlabeled" && !isLabeled)
        ) {
          collected.push({
            ...item,
            isLabeledByUser: isLabeled,
          });
        }
      }

      scanCursor = result.cursor;
      if (!scanCursor) break;
    }

    const response: ListSamplesResponse = {
      samples: collected.map((item) => ({
        sampleId: item.sample_id,
        folderId,
        capturedAt: item.captured_at,
        audioKey: item.audio_key,
        spectrogramKey: item.spectrogram_key,
        durationSec: item.duration_sec,
        isActive: item.is_active,
        isLabeledByUser: item.isLabeledByUser,
      })),
      ...(scanCursor && { cursor: scanCursor }),
    };
    return response;
  });

  // GET /api/samples/:sampleId
  fastify.get<{
    Params: { sampleId: string };
  }>("/api/samples/:sampleId", async (request, reply) => {
    const { sampleId } = request.params;
    const item = await getSampleDetail(docClient, config, sampleId);

    if (!item) {
      return reply.code(404).send({ error: "Sample not found" });
    }

    // Check if user has labeled this sample
    const userLabel = await getUserLabel(
      docClient,
      config,
      request.userId,
      sampleId,
    );

    const response: GetSampleResponse = {
      sample: {
        sampleId: item.sample_id,
        folderId: item.folder_id,
        sourceRecordingId: item.source_recording_id,
        capturedAt: item.captured_at,
        audioKey: item.audio_key,
        spectrogramKey: item.spectrogram_key,
        durationSec: item.duration_sec,
        isActive: item.is_active,
        audioUrl: resolveMediaUrl(config, item.audio_key),
        spectrogramUrl: resolveMediaUrl(config, item.spectrogram_key),
      },
    };

    if (userLabel) {
      response.userLabel = userLabel.label_category;

      // Only show aggregate after user has labeled
      const aggregate = await getSampleAggregate(docClient, config, sampleId);
      if (aggregate) {
        response.aggregate = {
          totalLabels: aggregate.total_labels,
          percentagesByCategory: computePercentages(
            aggregate.counts_by_category,
            aggregate.total_labels,
          ),
        };
      }
    }

    return response;
  });
}
