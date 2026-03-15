import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import type {
  FolderItem,
  SampleRefItem,
  SampleDetailItem,
  UserSampleLabelItem,
  SampleAggregateItem,
} from "@humpback/api";
import { LABEL_CATEGORIES, type LabelCategory } from "@humpback/api";

type DynamoItem =
  | FolderItem
  | SampleRefItem
  | SampleDetailItem
  | UserSampleLabelItem
  | SampleAggregateItem;

const endpoint =
  process.env["DYNAMODB_ENDPOINT"] ??
  `http://localhost:${process.env["DYNAMODB_PORT"] ?? "9000"}`;
const region = process.env["AWS_REGION"] ?? "us-west-2";
const catalogTable = process.env["CATALOG_TABLE"] ?? "Catalog";
const labelsTable = process.env["LABELS_TABLE"] ?? "Labels";

const client = new DynamoDBClient({
  region,
  endpoint,
  credentials: { accessKeyId: "local", secretAccessKey: "local" },
});

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

// --- Seed data definitions ---

interface FolderSeed {
  id: string;
  name: string;
  description: string;
  date: string;
  sampleCount: number;
}

const folders: FolderSeed[] = [
  {
    id: "north-2026-03-10",
    name: "North Hydrophone - 2026-03-10",
    description: "Morning recording session",
    date: "2026-03-10",
    sampleCount: 25,
  },
  {
    id: "south-2026-03-11",
    name: "South Hydrophone - 2026-03-11",
    description: "Afternoon recording session",
    date: "2026-03-11",
    sampleCount: 20,
  },
  {
    id: "west-2026-03-12",
    name: "West Hydrophone - 2026-03-12",
    description: "Full day recording",
    date: "2026-03-12",
    sampleCount: 20,
  },
];

function padId(n: number): string {
  return String(n).padStart(3, "0");
}

function sampleTime(date: string, index: number): string {
  const hours = 6 + Math.floor(index / 5);
  const minutes = (index % 5) * 12;
  return `${date}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00Z`;
}

function buildCatalogItems(): DynamoItem[] {
  const items: DynamoItem[] = [];

  for (const folder of folders) {
    const folderItem: FolderItem = {
      pk: `FOLDER#${folder.id}`,
      sk: "META",
      gsi1pk: "Folder",
      gsi1sk: `FOLDER#${folder.id}`,
      entity: "Folder",
      folder_id: folder.id,
      name: folder.name,
      description: folder.description,
      sample_count: folder.sampleCount,
      created_at: `${folder.date}T00:00:00Z`,
    };
    items.push(folderItem);

    for (let i = 0; i < folder.sampleCount; i++) {
      const sampleId = `sample_${folder.id}_${padId(i)}`;
      const capturedAt = sampleTime(folder.date, i);

      const ref: SampleRefItem = {
        pk: `FOLDER#${folder.id}`,
        sk: `SAMPLE#${capturedAt}#${sampleId}`,
        entity: "SampleRef",
        sample_id: sampleId,
        captured_at: capturedAt,
        audio_key: `samples/${folder.date.replaceAll("-", "/")}/${sampleId}.flac`,
        spectrogram_key: `spectrograms/${folder.date.replaceAll("-", "/")}/${sampleId}.png`,
        duration_sec: 5,
        is_active: true,
      };
      items.push(ref);

      const detail: SampleDetailItem = {
        pk: `SAMPLE#${sampleId}`,
        sk: "META",
        entity: "Sample",
        sample_id: sampleId,
        folder_id: folder.id,
        source_recording_id: `rec_${folder.id}_${padId(i)}`,
        captured_at: capturedAt,
        audio_key: ref.audio_key,
        spectrogram_key: ref.spectrogram_key,
        duration_sec: 5,
        is_active: true,
      };
      items.push(detail);
    }
  }

  return items;
}

function randomCategory(): LabelCategory {
  return LABEL_CATEGORIES[
    Math.floor(Math.random() * LABEL_CATEGORIES.length)
  ]!;
}

function buildLabelsItems(): DynamoItem[] {
  const items: DynamoItem[] = [];
  const firstFolder = folders[0]!;

  // dev_user_1 labels first 10 samples in the first folder
  const labeledCount = 10;
  const countsByCategory: Partial<Record<LabelCategory, number>> = {};

  for (let i = 0; i < labeledCount; i++) {
    const sampleId = `sample_${firstFolder.id}_${padId(i)}`;
    const capturedAt = sampleTime(firstFolder.date, i);
    const category = randomCategory();
    const now = capturedAt;

    countsByCategory[category] = (countsByCategory[category] ?? 0) + 1;

    const label: UserSampleLabelItem = {
      pk: `USER#dev_user_1`,
      sk: `LABEL#${sampleId}`,
      gsi1pk: `SAMPLE#${sampleId}`,
      gsi1sk: `USER#dev_user_1`,
      gsi2pk: `FOLDER#${firstFolder.id}`,
      gsi2sk: `${now}#USER#dev_user_1#SAMPLE#${sampleId}`,
      entity: "UserSampleLabel",
      user_id: "dev_user_1",
      sample_id: sampleId,
      folder_id: firstFolder.id,
      label_category: category,
      submitted_at: now,
      updated_at: now,
    };
    items.push(label);

    // Each labeled sample gets an aggregate (as if only dev_user_1 has labeled)
    const aggregate: SampleAggregateItem = {
      pk: `SAMPLE#${sampleId}`,
      sk: "AGGREGATE",
      entity: "SampleAggregate",
      sample_id: sampleId,
      total_labels: 1,
      counts_by_category: { [category]: 1 },
      updated_at: now,
    };
    items.push(aggregate);
  }

  return items;
}

async function batchWrite(
  tableName: string,
  items: DynamoItem[],
): Promise<void> {
  // DynamoDB BatchWriteItem supports max 25 items per request
  const batchSize = 25;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: batch.map((item) => ({
            PutRequest: { Item: item as unknown as Record<string, unknown> },
          })),
        },
      }),
    );
  }
}

async function main(): Promise<void> {
  console.log(`Seeding tables at ${endpoint}...`);

  const catalogItems = buildCatalogItems();
  console.log(`Writing ${catalogItems.length} items to "${catalogTable}"...`);
  await batchWrite(catalogTable, catalogItems);

  const labelsItems = buildLabelsItems();
  console.log(`Writing ${labelsItems.length} items to "${labelsTable}"...`);
  await batchWrite(labelsTable, labelsItems);

  console.log("Seed complete.");
  console.log(
    `  Folders: ${folders.length}`,
  );
  console.log(
    `  Samples: ${folders.reduce((sum, f) => sum + f.sampleCount, 0)} (with detail + ref items)`,
  );
  console.log(`  Labels: 10 (dev_user_1 in folder "${folders[0]!.id}")`);
}

main().catch((err: unknown) => {
  console.error("Failed to seed data:", err);
  process.exit(1);
});
