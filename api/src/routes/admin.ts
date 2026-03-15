import type { FastifyInstance } from "fastify";
import type { Config } from "../config.js";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  listLabelsByUser,
  listLabelsBySample,
  listLabelsByFolder,
} from "../data/labels.js";
import type { AdminLabelsResponse } from "../types/api.js";
import type { UserSampleLabelItem } from "../types/dynamo.js";

function labelItemToResponse(item: UserSampleLabelItem) {
  return {
    userId: item.user_id,
    sampleId: item.sample_id,
    folderId: item.folder_id,
    labelCategory: item.label_category,
    submittedAt: item.submitted_at,
    updatedAt: item.updated_at,
  };
}

export default async function adminRoutes(
  fastify: FastifyInstance,
  opts: { config: Config; docClient: DynamoDBDocumentClient },
): Promise<void> {
  const { config, docClient } = opts;

  // Admin role check hook
  fastify.addHook("onRequest", async (request, reply) => {
    if (request.userRole !== "admin") {
      return reply.code(403).send({ error: "Admin access required" });
    }
  });

  // GET /api/admin/labels?userId=&sampleId=&folderId=&from=&to=&cursor=&limit=
  fastify.get<{
    Querystring: {
      userId?: string;
      sampleId?: string;
      folderId?: string;
      from?: string;
      to?: string;
      cursor?: string;
      limit?: string;
    };
  }>("/api/admin/labels", async (request, reply) => {
    const { userId, sampleId, folderId, from, to, cursor, limit } =
      request.query;
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;

    let result;

    if (userId) {
      result = await listLabelsByUser(
        docClient,
        config,
        userId,
        cursor,
        parsedLimit,
      );
    } else if (sampleId) {
      result = await listLabelsBySample(
        docClient,
        config,
        sampleId,
        cursor,
        parsedLimit,
      );
    } else if (folderId) {
      result = await listLabelsByFolder(
        docClient,
        config,
        folderId,
        from,
        to,
        cursor,
        parsedLimit,
      );
    } else {
      return reply
        .code(400)
        .send({ error: "Provide userId, sampleId, or folderId" });
    }

    const response: AdminLabelsResponse = {
      labels: result.items.map(labelItemToResponse),
      ...(result.cursor && { cursor: result.cursor }),
    };
    return response;
  });
}
