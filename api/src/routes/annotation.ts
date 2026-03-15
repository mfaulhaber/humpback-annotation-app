import type { FastifyInstance } from "fastify";
import type { Config } from "../config.js";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { getSampleDetail } from "../data/catalog.js";
import { getUserLabel, submitLabel } from "../data/labels.js";
import { computePercentages } from "../lib/percentages.js";
import { LABEL_CATEGORIES } from "../types/labels.js";
import type { SubmitLabelRequest, SubmitLabelResponse } from "../types/api.js";

export default async function annotationRoutes(
  fastify: FastifyInstance,
  opts: { config: Config; docClient: DynamoDBDocumentClient },
): Promise<void> {
  const { config, docClient } = opts;

  // PUT /api/samples/:sampleId/label
  fastify.put<{
    Params: { sampleId: string };
    Body: SubmitLabelRequest;
  }>("/api/samples/:sampleId/label", async (request, reply) => {
    const { sampleId } = request.params;
    const { category } = request.body;

    // Validate category
    if (
      !category ||
      !(LABEL_CATEGORIES as readonly string[]).includes(category)
    ) {
      return reply.code(400).send({
        error: "Invalid category",
        validCategories: LABEL_CATEGORIES,
      });
    }

    // Validate sample exists
    const sample = await getSampleDetail(docClient, config, sampleId);
    if (!sample) {
      return reply.code(404).send({ error: "Sample not found" });
    }

    // Check for existing label
    const existingLabel = await getUserLabel(
      docClient,
      config,
      request.userId,
      sampleId,
    );

    // Submit label (handles first-label, relabel, and same-label-noop)
    const result = await submitLabel(
      docClient,
      config,
      request.userId,
      sampleId,
      sample.folder_id,
      category,
      existingLabel,
    );

    const response: SubmitLabelResponse = {
      sampleId,
      userLabel: result.label.label_category,
      aggregate: {
        totalLabels: result.aggregate.total_labels,
        percentagesByCategory: computePercentages(
          result.aggregate.counts_by_category,
          result.aggregate.total_labels,
        ),
      },
    };
    return response;
  });
}
