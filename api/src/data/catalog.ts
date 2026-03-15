import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Config } from "../config.js";
import type {
  FolderItem,
  SampleRefItem,
  SampleDetailItem,
} from "../types/dynamo.js";

export interface PaginatedResult<T> {
  items: T[];
  cursor?: string;
}

function encodeCursor(
  lastEvaluatedKey: Record<string, unknown>,
): string {
  return Buffer.from(JSON.stringify(lastEvaluatedKey)).toString("base64url");
}

function decodeCursor(
  cursor: string,
): Record<string, unknown> {
  return JSON.parse(
    Buffer.from(cursor, "base64url").toString("utf8"),
  ) as Record<string, unknown>;
}

export async function listFolders(
  docClient: DynamoDBDocumentClient,
  config: Config,
  cursor?: string,
  limit = 50,
): Promise<PaginatedResult<FolderItem>> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: config.catalogTable,
      IndexName: "GSI1",
      KeyConditionExpression: "gsi1pk = :pk",
      ExpressionAttributeValues: { ":pk": "Folder" },
      Limit: limit,
      ...(cursor && { ExclusiveStartKey: decodeCursor(cursor) }),
    }),
  );

  return {
    items: (result.Items ?? []) as FolderItem[],
    ...(result.LastEvaluatedKey && {
      cursor: encodeCursor(result.LastEvaluatedKey),
    }),
  };
}

export async function listSamplesInFolder(
  docClient: DynamoDBDocumentClient,
  config: Config,
  folderId: string,
  cursor?: string,
  limit = 20,
): Promise<PaginatedResult<SampleRefItem>> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: config.catalogTable,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": `FOLDER#${folderId}`,
        ":prefix": "SAMPLE#",
      },
      Limit: limit,
      ...(cursor && { ExclusiveStartKey: decodeCursor(cursor) }),
    }),
  );

  return {
    items: (result.Items ?? []) as SampleRefItem[],
    ...(result.LastEvaluatedKey && {
      cursor: encodeCursor(result.LastEvaluatedKey),
    }),
  };
}

export async function getSampleDetail(
  docClient: DynamoDBDocumentClient,
  config: Config,
  sampleId: string,
): Promise<SampleDetailItem | undefined> {
  const result = await docClient.send(
    new GetCommand({
      TableName: config.catalogTable,
      Key: { pk: `SAMPLE#${sampleId}`, sk: "META" },
    }),
  );

  return result.Item as SampleDetailItem | undefined;
}
