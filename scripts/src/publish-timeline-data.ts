import path from "node:path";
import {
  DEFAULT_AWS_REGION,
  assertDirectoryExists,
  assertFileExists,
  createCloudFrontClient,
  createS3Client,
  hasFlag,
  invalidatePaths,
  readFlagValue,
  requireEnv,
  resolveRepoPath,
  uploadDirectory,
} from "./publish-support.js";

function cacheControlFor(relativePath: string): string {
  if (relativePath === "index.json" || relativePath.endsWith("/manifest.json")) {
    return "public, max-age=300";
  }

  if (relativePath.endsWith(".png") || relativePath.endsWith(".mp3")) {
    return "public, max-age=31536000, immutable";
  }

  return "public, max-age=300";
}

function invalidationPathsFor(keys: string[]): string[] {
  const paths = new Set<string>(["/data/index.json"]);

  for (const key of keys) {
    if (key.endsWith("/manifest.json")) {
      paths.add(`/data/${key}`);
    }
  }

  return [...paths];
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = hasFlag(args, "--dry-run");
  const skipInvalidation = hasFlag(args, "--no-invalidate");
  const exportRootArg =
    readFlagValue(args, "--path") ?? process.env["TIMELINE_EXPORT_ROOT"];
  const region = process.env["AWS_REGION"] ?? DEFAULT_AWS_REGION;
  const bucketName = requireEnv("STATIC_VIEWER_DATA_BUCKET_NAME");
  const distributionId = process.env["STATIC_VIEWER_DISTRIBUTION_ID"]?.trim();

  if (!exportRootArg) {
    throw new Error(
      "Provide --path <export-root> or set TIMELINE_EXPORT_ROOT to the local export directory.",
    );
  }

  if (!skipInvalidation && !distributionId) {
    throw new Error(
      "Missing STATIC_VIEWER_DISTRIBUTION_ID. Set it or pass --no-invalidate.",
    );
  }

  const exportRoot = resolveRepoPath(exportRootArg);
  await assertDirectoryExists(exportRoot, "Timeline export root");
  await assertFileExists(
    path.join(exportRoot, "index.json"),
    "Timeline export index.json",
  );

  console.log(`[publish] Region: ${region}`);
  console.log(`[publish] Data bucket: ${bucketName}`);
  console.log(`[publish] Export root: ${exportRoot}`);

  const uploadedKeys = await uploadDirectory({
    bucket: bucketName,
    cacheControlFor,
    client: createS3Client(region),
    directory: exportRoot,
    dryRun,
    label: "timeline data publish",
  });

  if (!skipInvalidation && distributionId) {
    await invalidatePaths({
      cloudFrontClient: createCloudFrontClient(),
      distributionId,
      dryRun,
      label: "timeline-data",
      paths: invalidationPathsFor(uploadedKeys),
    });
  } else {
    console.log("[publish] Skipping CloudFront invalidation.");
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[publish] Failed to publish timeline data: ${message}`);
  process.exit(1);
});
