import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ResourceNotFoundException,
  waitUntilTableExists,
} from "@aws-sdk/client-dynamodb";

const endpoint = process.env["DYNAMODB_ENDPOINT"] ?? "http://localhost:8000";
const region = process.env["AWS_REGION"] ?? "us-west-2";
const catalogTable = process.env["CATALOG_TABLE"] ?? "Catalog";
const labelsTable = process.env["LABELS_TABLE"] ?? "Labels";

const client = new DynamoDBClient({
  region,
  endpoint,
  credentials: { accessKeyId: "local", secretAccessKey: "local" },
});

async function tableExists(tableName: string): Promise<boolean> {
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    return true;
  } catch (err) {
    if (err instanceof ResourceNotFoundException) return false;
    throw err;
  }
}

async function createCatalogTable(): Promise<void> {
  if (await tableExists(catalogTable)) {
    console.log(`Table "${catalogTable}" already exists — skipping.`);
    return;
  }

  await client.send(
    new CreateTableCommand({
      TableName: catalogTable,
      KeySchema: [
        { AttributeName: "pk", KeyType: "HASH" },
        { AttributeName: "sk", KeyType: "RANGE" },
      ],
      AttributeDefinitions: [
        { AttributeName: "pk", AttributeType: "S" },
        { AttributeName: "sk", AttributeType: "S" },
        { AttributeName: "gsi1pk", AttributeType: "S" },
        { AttributeName: "gsi1sk", AttributeType: "S" },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: "GSI1",
          KeySchema: [
            { AttributeName: "gsi1pk", KeyType: "HASH" },
            { AttributeName: "gsi1sk", KeyType: "RANGE" },
          ],
          Projection: { ProjectionType: "ALL" },
        },
      ],
      BillingMode: "PAY_PER_REQUEST",
    }),
  );

  await waitUntilTableExists(
    { client, maxWaitTime: 30 },
    { TableName: catalogTable },
  );
  console.log(`Created table "${catalogTable}".`);
}

async function createLabelsTable(): Promise<void> {
  if (await tableExists(labelsTable)) {
    console.log(`Table "${labelsTable}" already exists — skipping.`);
    return;
  }

  await client.send(
    new CreateTableCommand({
      TableName: labelsTable,
      KeySchema: [
        { AttributeName: "pk", KeyType: "HASH" },
        { AttributeName: "sk", KeyType: "RANGE" },
      ],
      AttributeDefinitions: [
        { AttributeName: "pk", AttributeType: "S" },
        { AttributeName: "sk", AttributeType: "S" },
        { AttributeName: "gsi1pk", AttributeType: "S" },
        { AttributeName: "gsi1sk", AttributeType: "S" },
        { AttributeName: "gsi2pk", AttributeType: "S" },
        { AttributeName: "gsi2sk", AttributeType: "S" },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: "GSI1",
          KeySchema: [
            { AttributeName: "gsi1pk", KeyType: "HASH" },
            { AttributeName: "gsi1sk", KeyType: "RANGE" },
          ],
          Projection: { ProjectionType: "ALL" },
        },
        {
          IndexName: "GSI2",
          KeySchema: [
            { AttributeName: "gsi2pk", KeyType: "HASH" },
            { AttributeName: "gsi2sk", KeyType: "RANGE" },
          ],
          Projection: { ProjectionType: "ALL" },
        },
      ],
      BillingMode: "PAY_PER_REQUEST",
    }),
  );

  await waitUntilTableExists(
    { client, maxWaitTime: 30 },
    { TableName: labelsTable },
  );
  console.log(`Created table "${labelsTable}".`);
}

async function main(): Promise<void> {
  console.log(`Initializing tables at ${endpoint}...`);
  await createCatalogTable();
  await createLabelsTable();
  console.log("Done.");
}

main().catch((err: unknown) => {
  console.error("Failed to initialize tables:", err);
  process.exit(1);
});
