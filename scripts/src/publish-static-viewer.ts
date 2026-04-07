import {
  DEFAULT_AWS_REGION,
  assertDirectoryExists,
  createCloudFrontClient,
  createS3Client,
  getRepoRoot,
  hasFlag,
  invalidatePaths,
  readFlagValue,
  requireEnv,
  resolveRepoPath,
  runFrontendBuild,
  uploadDirectory,
} from "./publish-support.js";

function cacheControlFor(relativePath: string): string {
  if (relativePath === "index.html") {
    return "no-cache, no-store, must-revalidate";
  }

  if (relativePath.startsWith("assets/")) {
    return "public, max-age=31536000, immutable";
  }

  return "public, max-age=300";
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = hasFlag(args, "--dry-run");
  const skipBuild = hasFlag(args, "--skip-build");
  const skipInvalidation = hasFlag(args, "--no-invalidate");
  const distArg = readFlagValue(args, "--dist");
  const distDirectory = resolveRepoPath(distArg ?? "frontend/dist");
  const region = process.env["AWS_REGION"] ?? DEFAULT_AWS_REGION;
  const bucketName = requireEnv("STATIC_VIEWER_APP_BUCKET_NAME");
  const distributionId = process.env["STATIC_VIEWER_DISTRIBUTION_ID"]?.trim();

  if (!skipInvalidation && !distributionId) {
    throw new Error(
      "Missing STATIC_VIEWER_DISTRIBUTION_ID. Set it or pass --no-invalidate.",
    );
  }

  if (!skipBuild) {
    runFrontendBuild();
  } else {
    console.log("[publish] Skipping frontend build.");
  }

  await assertDirectoryExists(distDirectory, "Frontend dist directory");

  console.log(`[publish] Repo root: ${getRepoRoot()}`);
  console.log(`[publish] Region: ${region}`);
  console.log(`[publish] App bucket: ${bucketName}`);
  console.log(`[publish] Dist directory: ${distDirectory}`);

  const s3Client = createS3Client(region);
  await uploadDirectory({
    bucket: bucketName,
    cacheControlFor,
    client: s3Client,
    directory: distDirectory,
    dryRun,
    label: "static viewer app publish",
  });

  if (!skipInvalidation && distributionId) {
    await invalidatePaths({
      cloudFrontClient: createCloudFrontClient(),
      distributionId,
      dryRun,
      label: "static-viewer-app",
      paths: ["/", "/index.html"],
    });
  } else {
    console.log("[publish] Skipping CloudFront invalidation.");
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[publish] Failed to publish static viewer app: ${message}`);
  process.exit(1);
});
