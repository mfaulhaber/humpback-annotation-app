import {
  BatchGetCommand,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Config } from "../config.js";
import type { LabelCategory } from "../types/labels.js";
import type {
  UserSampleLabelItem,
  SampleAggregateItem,
} from "../types/dynamo.js";
import { LabelsKeys } from "../types/dynamo.js";
import type { PaginatedResult } from "./catalog.js";

function encodeCursor(lastEvaluatedKey: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(lastEvaluatedKey)).toString("base64url");
}

function decodeCursor(cursor: string): Record<string, unknown> {
  return JSON.parse(
    Buffer.from(cursor, "base64url").toString("utf8"),
  ) as Record<string, unknown>;
}

export async function getUserLabel(
  docClient: DynamoDBDocumentClient,
  config: Config,
  userId: string,
  sampleId: string,
): Promise<UserSampleLabelItem | undefined> {
  const result = await docClient.send(
    new GetCommand({
      TableName: config.labelsTable,
      Key: {
        pk: LabelsKeys.userPk(userId),
        sk: LabelsKeys.labelSk(sampleId),
      },
    }),
  );
  return result.Item as UserSampleLabelItem | undefined;
}

export async function getSampleAggregate(
  docClient: DynamoDBDocumentClient,
  config: Config,
  sampleId: string,
): Promise<SampleAggregateItem | undefined> {
  const result = await docClient.send(
    new GetCommand({
      TableName: config.labelsTable,
      Key: {
        pk: LabelsKeys.aggregatePk(sampleId),
        sk: LabelsKeys.aggregateSk(),
      },
    }),
  );
  return result.Item as SampleAggregateItem | undefined;
}

export async function batchGetUserLabels(
  docClient: DynamoDBDocumentClient,
  config: Config,
  userId: string,
  sampleIds: string[],
): Promise<Map<string, UserSampleLabelItem>> {
  const map = new Map<string, UserSampleLabelItem>();
  if (sampleIds.length === 0) return map;

  // BatchGetItem supports max 100 keys per request
  const batchSize = 100;
  for (let i = 0; i < sampleIds.length; i += batchSize) {
    const batch = sampleIds.slice(i, i + batchSize);
    const result = await docClient.send(
      new BatchGetCommand({
        RequestItems: {
          [config.labelsTable]: {
            Keys: batch.map((sampleId) => ({
              pk: LabelsKeys.userPk(userId),
              sk: LabelsKeys.labelSk(sampleId),
            })),
          },
        },
      }),
    );

    const items =
      (result.Responses?.[config.labelsTable] as
        | UserSampleLabelItem[]
        | undefined) ?? [];
    for (const item of items) {
      map.set(item.sample_id, item);
    }
  }

  return map;
}

export interface SubmitLabelResult {
  label: UserSampleLabelItem;
  aggregate: SampleAggregateItem;
}

export async function submitLabel(
  docClient: DynamoDBDocumentClient,
  config: Config,
  userId: string,
  sampleId: string,
  folderId: string,
  category: LabelCategory,
  existingLabel?: UserSampleLabelItem,
): Promise<SubmitLabelResult> {
  const now = new Date().toISOString();

  if (existingLabel && existingLabel.label_category === category) {
    // Same label — no-op, just return current state
    const aggregate = await getSampleAggregate(docClient, config, sampleId);
    return {
      label: existingLabel,
      aggregate: aggregate ?? {
        pk: LabelsKeys.aggregatePk(sampleId),
        sk: "AGGREGATE" as const,
        entity: "SampleAggregate" as const,
        sample_id: sampleId,
        total_labels: 1,
        counts_by_category: { [category]: 1 },
        updated_at: now,
      },
    };
  }

  if (existingLabel) {
    // Relabel: update label item, decrement old category, increment new
    const oldCategory = existingLabel.label_category;
    const gsi2sk = LabelsKeys.gsi2Sk(now, userId, sampleId);

    await docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: config.labelsTable,
              Key: {
                pk: LabelsKeys.userPk(userId),
                sk: LabelsKeys.labelSk(sampleId),
              },
              UpdateExpression:
                "SET label_category = :cat, updated_at = :now, gsi2sk = :gsi2sk",
              ExpressionAttributeValues: {
                ":cat": category,
                ":now": now,
                ":gsi2sk": gsi2sk,
              },
            },
          },
          {
            Update: {
              TableName: config.labelsTable,
              Key: {
                pk: LabelsKeys.aggregatePk(sampleId),
                sk: LabelsKeys.aggregateSk(),
              },
              UpdateExpression:
                "ADD counts_by_category.#newCat :one, counts_by_category.#oldCat :negOne SET updated_at = :now",
              ExpressionAttributeNames: {
                "#newCat": category,
                "#oldCat": oldCategory,
              },
              ExpressionAttributeValues: {
                ":one": 1,
                ":negOne": -1,
                ":now": now,
              },
            },
          },
        ],
      }),
    );
  } else {
    // First label: insert label item, create/update aggregate
    const gsi2sk = LabelsKeys.gsi2Sk(now, userId, sampleId);

    await docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: config.labelsTable,
              Item: {
                pk: LabelsKeys.userPk(userId),
                sk: LabelsKeys.labelSk(sampleId),
                gsi1pk: LabelsKeys.sampleGsi1Pk(sampleId),
                gsi1sk: LabelsKeys.userGsi1Sk(userId),
                gsi2pk: LabelsKeys.folderGsi2Pk(folderId),
                gsi2sk: gsi2sk,
                entity: "UserSampleLabel",
                user_id: userId,
                sample_id: sampleId,
                folder_id: folderId,
                label_category: category,
                submitted_at: now,
                updated_at: now,
              },
              ConditionExpression: "attribute_not_exists(pk)",
            },
          },
          {
            Update: {
              TableName: config.labelsTable,
              Key: {
                pk: LabelsKeys.aggregatePk(sampleId),
                sk: LabelsKeys.aggregateSk(),
              },
              UpdateExpression:
                "ADD total_labels :one, counts_by_category.#cat :one SET entity = :entity, sample_id = :sid, updated_at = :now",
              ExpressionAttributeNames: { "#cat": category },
              ExpressionAttributeValues: {
                ":one": 1,
                ":entity": "SampleAggregate",
                ":sid": sampleId,
                ":now": now,
              },
            },
          },
        ],
      }),
    );
  }

  // Read back the updated state
  const [updatedLabel, updatedAggregate] = await Promise.all([
    getUserLabel(docClient, config, userId, sampleId),
    getSampleAggregate(docClient, config, sampleId),
  ]);

  return {
    label: updatedLabel!,
    aggregate: updatedAggregate!,
  };
}

export async function listLabelsByUser(
  docClient: DynamoDBDocumentClient,
  config: Config,
  userId: string,
  cursor?: string,
  limit = 50,
): Promise<PaginatedResult<UserSampleLabelItem>> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: config.labelsTable,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": LabelsKeys.userPk(userId),
        ":prefix": "LABEL#",
      },
      Limit: limit,
      ...(cursor && { ExclusiveStartKey: decodeCursor(cursor) }),
    }),
  );

  return {
    items: (result.Items ?? []) as UserSampleLabelItem[],
    ...(result.LastEvaluatedKey && {
      cursor: encodeCursor(result.LastEvaluatedKey),
    }),
  };
}

export async function listLabelsBySample(
  docClient: DynamoDBDocumentClient,
  config: Config,
  sampleId: string,
  cursor?: string,
  limit = 50,
): Promise<PaginatedResult<UserSampleLabelItem>> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: config.labelsTable,
      IndexName: "GSI1",
      KeyConditionExpression: "gsi1pk = :pk",
      ExpressionAttributeValues: {
        ":pk": LabelsKeys.sampleGsi1Pk(sampleId),
      },
      Limit: limit,
      ...(cursor && { ExclusiveStartKey: decodeCursor(cursor) }),
    }),
  );

  return {
    items: (result.Items ?? []) as UserSampleLabelItem[],
    ...(result.LastEvaluatedKey && {
      cursor: encodeCursor(result.LastEvaluatedKey),
    }),
  };
}

export async function listLabelsByFolder(
  docClient: DynamoDBDocumentClient,
  config: Config,
  folderId: string,
  from?: string,
  to?: string,
  cursor?: string,
  limit = 50,
): Promise<PaginatedResult<UserSampleLabelItem>> {
  let keyCondition = "gsi2pk = :pk";
  const exprValues: Record<string, unknown> = {
    ":pk": LabelsKeys.folderGsi2Pk(folderId),
  };

  if (from && to) {
    keyCondition += " AND gsi2sk BETWEEN :from AND :to";
    exprValues[":from"] = from;
    exprValues[":to"] = to;
  } else if (from) {
    keyCondition += " AND gsi2sk >= :from";
    exprValues[":from"] = from;
  } else if (to) {
    keyCondition += " AND gsi2sk <= :to";
    exprValues[":to"] = to;
  }

  const result = await docClient.send(
    new QueryCommand({
      TableName: config.labelsTable,
      IndexName: "GSI2",
      KeyConditionExpression: keyCondition,
      ExpressionAttributeValues: exprValues,
      Limit: limit,
      ...(cursor && { ExclusiveStartKey: decodeCursor(cursor) }),
    }),
  );

  return {
    items: (result.Items ?? []) as UserSampleLabelItem[],
    ...(result.LastEvaluatedKey && {
      cursor: encodeCursor(result.LastEvaluatedKey),
    }),
  };
}
