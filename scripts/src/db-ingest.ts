import { readdirSync, statSync, existsSync } from "node:fs";
import { resolve, relative, join, extname, basename } from "node:path";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import type {
  FolderItem,
  SampleRefItem,
  SampleDetailItem,
} from "@humpback/api";
import { CatalogKeys } from "@humpback/api";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  path: string;
  mediaRoot: string;
  all: boolean;
  dryRun: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let path = "";
  let mediaRoot = process.env["MEDIA_ROOT"] ?? "";
  let all = false;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--path" && args[i + 1]) {
      path = args[++i]!;
    } else if (arg === "--media-root" && args[i + 1]) {
      mediaRoot = args[++i]!;
    } else if (arg === "--all") {
      all = true;
    } else if (arg === "--dry-run") {
      dryRun = true;
    }
  }

  if (!path) {
    console.error("Usage: db-ingest --path <dataset-or-parent-dir> [--media-root <root>] [--all] [--dry-run]");
    process.exit(1);
  }

  if (!mediaRoot) {
    // Derive media root: walk up from path to find the directory above "positives/"
    const absPath = resolve(path);
    const posIdx = absPath.indexOf("/positives/");
    if (posIdx !== -1) {
      mediaRoot = absPath.slice(0, posIdx);
    } else {
      console.error("Cannot derive MEDIA_ROOT. Set MEDIA_ROOT env var or use --media-root.");
      process.exit(1);
    }
  }

  return { path: resolve(path), mediaRoot: resolve(mediaRoot), all, dryRun };
}

// ---------------------------------------------------------------------------
// Filename timestamp parsing
// ---------------------------------------------------------------------------

const AUDIO_EXTENSIONS = new Set([".flac", ".wav", ".mp3"]);
const TIMESTAMP_RE = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(?:\.\d+)?Z$/;

function parseTimestamp(ts: string): Date | null {
  const m = TIMESTAMP_RE.exec(ts);
  if (!m) return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
}

interface ParsedSample {
  sampleId: string;
  datasetName: string;
  capturedAt: string;
  durationSec: number;
  audioKey: string;
  spectrogramKey: string | null;
}

function parseFilename(
  stem: string,
  datasetName: string,
  audioExt: string,
  hasPng: boolean,
  dayDir: string,
  mediaRoot: string,
): ParsedSample | null {
  // Stem format: {START_TIMESTAMP}Z_{END_TIMESTAMP}Z
  const parts = stem.split("_");
  if (parts.length < 2) return null;

  const startStr = parts[0]!;
  const endStr = parts[1]!;

  const startDate = parseTimestamp(startStr);
  const endDate = parseTimestamp(endStr);
  if (!startDate || !endDate) return null;

  const durationSec = Math.round((endDate.getTime() - startDate.getTime()) / 1000);
  if (durationSec <= 0) return null;

  const capturedAt = startDate.toISOString().replace(".000Z", "Z");

  const relDir = relative(mediaRoot, dayDir);
  const audioKey = join(relDir, `${stem}${audioExt}`);
  const spectrogramKey = hasPng ? join(relDir, `${stem}.png`) : null;

  return {
    sampleId: `${datasetName}_${stem}`,
    datasetName,
    capturedAt,
    durationSec,
    audioKey,
    spectrogramKey,
  };
}

// ---------------------------------------------------------------------------
// Directory walking
// ---------------------------------------------------------------------------

function isDigitDir(name: string, expectedLength: number): boolean {
  return name.length === expectedLength && /^\d+$/.test(name);
}

function discoverSamples(
  datasetDir: string,
  datasetName: string,
  mediaRoot: string,
): ParsedSample[] {
  const samples: ParsedSample[] = [];

  // Walk YYYY/MM/DD directories
  const yearDirs = readdirSync(datasetDir).filter(
    (d) => isDigitDir(d, 4) && statSync(join(datasetDir, d)).isDirectory(),
  );

  for (const year of yearDirs) {
    const yearPath = join(datasetDir, year);
    const monthDirs = readdirSync(yearPath).filter(
      (d) => isDigitDir(d, 2) && statSync(join(yearPath, d)).isDirectory(),
    );

    for (const month of monthDirs) {
      const monthPath = join(yearPath, month);
      const dayDirs = readdirSync(monthPath).filter(
        (d) => isDigitDir(d, 2) && statSync(join(monthPath, d)).isDirectory(),
      );

      for (const day of dayDirs) {
        const dayPath = join(monthPath, day);
        const files = readdirSync(dayPath);

        // Group files by stem
        const pngStems = new Set<string>();
        const audioFiles: { stem: string; ext: string }[] = [];

        for (const file of files) {
          const ext = extname(file).toLowerCase();
          const stem = basename(file, ext);

          if (ext === ".png") {
            pngStems.add(stem);
          } else if (AUDIO_EXTENSIONS.has(ext)) {
            audioFiles.push({ stem, ext });
          }
        }

        for (const { stem, ext } of audioFiles) {
          const parsed = parseFilename(
            stem,
            datasetName,
            ext,
            pngStems.has(stem),
            dayPath,
            mediaRoot,
          );
          if (parsed) {
            samples.push(parsed);
          } else {
            console.warn(`  Skipping unparseable filename: ${stem}${ext}`);
          }
        }
      }
    }
  }

  // Sort by capturedAt for consistent ordering
  samples.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  return samples;
}

// ---------------------------------------------------------------------------
// DynamoDB item builders
// ---------------------------------------------------------------------------

function buildItems(
  datasetName: string,
  samples: ParsedSample[],
): { folder: FolderItem; refs: SampleRefItem[]; details: SampleDetailItem[] } {
  const now = new Date().toISOString().replace(".000Z", "Z");

  const folder: FolderItem = {
    pk: CatalogKeys.folderPk(datasetName),
    sk: "META",
    gsi1pk: "Folder",
    gsi1sk: `FOLDER#${datasetName}`,
    entity: "Folder",
    folder_id: datasetName,
    name: datasetName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    description: `Ingested dataset: ${datasetName} (${samples.length} samples)`,
    sample_count: samples.length,
    created_at: now,
  };

  const refs: SampleRefItem[] = [];
  const details: SampleDetailItem[] = [];

  for (const s of samples) {
    refs.push({
      pk: CatalogKeys.folderPk(datasetName),
      sk: CatalogKeys.sampleRefSk(s.capturedAt, s.sampleId),
      entity: "SampleRef",
      sample_id: s.sampleId,
      captured_at: s.capturedAt,
      audio_key: s.audioKey,
      spectrogram_key: s.spectrogramKey,
      duration_sec: s.durationSec,
      is_active: true,
    });

    details.push({
      pk: CatalogKeys.sampleDetailPk(s.sampleId),
      sk: "META",
      entity: "Sample",
      sample_id: s.sampleId,
      folder_id: datasetName,
      source_recording_id: datasetName,
      captured_at: s.capturedAt,
      audio_key: s.audioKey,
      spectrogram_key: s.spectrogramKey,
      duration_sec: s.durationSec,
      is_active: true,
    });
  }

  return { folder, refs, details };
}

// ---------------------------------------------------------------------------
// DynamoDB write
// ---------------------------------------------------------------------------

type DynamoItem = FolderItem | SampleRefItem | SampleDetailItem;

async function batchWrite(
  docClient: DynamoDBDocumentClient,
  tableName: string,
  items: DynamoItem[],
): Promise<void> {
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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { path: inputPath, mediaRoot, all, dryRun } = parseArgs();

  if (!existsSync(inputPath)) {
    console.error(`Path does not exist: ${inputPath}`);
    process.exit(1);
  }

  // Discover datasets
  let datasets: { name: string; dir: string }[];
  if (all) {
    const subdirs = readdirSync(inputPath).filter((d) =>
      statSync(join(inputPath, d)).isDirectory(),
    );
    datasets = subdirs.map((d) => ({ name: d, dir: join(inputPath, d) }));
  } else {
    const name = basename(inputPath);
    datasets = [{ name, dir: inputPath }];
  }

  if (datasets.length === 0) {
    console.error("No datasets found.");
    process.exit(1);
  }

  console.log(`MEDIA_ROOT: ${mediaRoot}`);
  console.log(`Datasets to ingest: ${datasets.map((d) => d.name).join(", ")}`);
  console.log(`Dry run: ${dryRun}\n`);

  // Discover and build items for all datasets
  let totalSamples = 0;
  let totalMissingSpectrograms = 0;
  const allItems: DynamoItem[] = [];

  for (const dataset of datasets) {
    console.log(`Scanning ${dataset.name} at ${dataset.dir}...`);
    const samples = discoverSamples(dataset.dir, dataset.name, mediaRoot);

    if (samples.length === 0) {
      console.warn(`  No samples found in ${dataset.name}, skipping.`);
      continue;
    }

    const missingSpectrograms = samples.filter((s) => !s.spectrogramKey).length;
    totalSamples += samples.length;
    totalMissingSpectrograms += missingSpectrograms;

    console.log(`  Found ${samples.length} samples (${missingSpectrograms} missing spectrograms)`);

    const { folder, refs, details } = buildItems(dataset.name, samples);
    allItems.push(folder, ...refs, ...details);
  }

  console.log(`\nTotal: ${datasets.length} dataset(s), ${totalSamples} samples, ${totalMissingSpectrograms} missing spectrograms`);
  console.log(`DynamoDB items to write: ${allItems.length}`);

  if (dryRun) {
    console.log("\n--- DRY RUN: No items written ---");
    // Print first few items as a sample
    for (const item of allItems.slice(0, 6)) {
      console.log(JSON.stringify(item, null, 2));
    }
    if (allItems.length > 6) {
      console.log(`... and ${allItems.length - 6} more items`);
    }
    return;
  }

  // Write to DynamoDB
  const endpoint =
    process.env["DYNAMODB_ENDPOINT"] ??
    `http://localhost:${process.env["DYNAMODB_PORT"] ?? "9000"}`;
  const region = process.env["AWS_REGION"] ?? "us-west-2";
  const catalogTable = process.env["CATALOG_TABLE"] ?? "Catalog";

  const client = new DynamoDBClient({
    region,
    endpoint,
    credentials: { accessKeyId: "local", secretAccessKey: "local" },
  });
  const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });

  console.log(`\nWriting ${allItems.length} items to "${catalogTable}" at ${endpoint}...`);
  await batchWrite(docClient, catalogTable, allItems);
  console.log("Ingestion complete.");
}

main().catch((err: unknown) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
