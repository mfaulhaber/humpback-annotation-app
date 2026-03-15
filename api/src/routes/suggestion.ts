import type { FastifyInstance } from "fastify";
import type { Config } from "../config.js";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { listSamplesInFolder } from "../data/catalog.js";
import { batchGetUserLabels } from "../data/labels.js";
import type { SuggestNextResponse } from "../types/api.js";

export default async function suggestionRoutes(
  fastify: FastifyInstance,
  opts: { config: Config; docClient: DynamoDBDocumentClient },
): Promise<void> {
  const { config, docClient } = opts;

  // GET /api/samples/suggest-next?folderId=
  fastify.get<{
    Querystring: { folderId?: string };
  }>("/api/samples/suggest-next", async (request, reply) => {
    const { folderId } = request.query;

    if (!folderId) {
      return reply.code(400).send({ error: "folderId query parameter is required" });
    }

    // Scan pages of samples until we find an unlabeled one
    let cursor: string | undefined;
    const pageSize = 50;
    const maxPages = 20; // safety limit

    for (let page = 0; page < maxPages; page++) {
      const result = await listSamplesInFolder(
        docClient,
        config,
        folderId,
        cursor,
        pageSize,
      );

      if (result.items.length === 0) break;

      const sampleIds = result.items.map((item) => item.sample_id);
      const labelMap = await batchGetUserLabels(
        docClient,
        config,
        request.userId,
        sampleIds,
      );

      const unlabeled = sampleIds.filter((id) => !labelMap.has(id));

      if (unlabeled.length > 0) {
        // Pick a random unlabeled sample from this page
        const chosen = unlabeled[Math.floor(Math.random() * unlabeled.length)]!;
        const response: SuggestNextResponse = { sampleId: chosen };
        return response;
      }

      cursor = result.cursor;
      if (!cursor) break; // no more pages
    }

    // All samples in folder are labeled
    return reply.code(204).send();
  });
}
