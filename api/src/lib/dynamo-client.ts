import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Config } from "../config.js";

let docClient: DynamoDBDocumentClient | undefined;

export function getDocClient(config: Config): DynamoDBDocumentClient {
  if (docClient) return docClient;

  const client = new DynamoDBClient({
    region: config.awsRegion,
    ...(config.dynamoEndpoint && {
      endpoint: config.dynamoEndpoint,
      credentials: { accessKeyId: "local", secretAccessKey: "local" },
    }),
  });

  docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });

  return docClient;
}
