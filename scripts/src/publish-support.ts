import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CloudFormationClient,
  DescribeStacksCommand,
} from "@aws-sdk/client-cloudformation";
import {
  CloudFrontClient,
  CreateInvalidationCommand,
} from "@aws-sdk/client-cloudfront";
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export const DEFAULT_AWS_REGION = "us-west-2";
const CLOUDFRONT_REGION = "us-east-1";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");

export interface UploadDirectoryOptions {
  bucket: string;
  cacheControlFor: (relativePath: string) => string;
  client: S3Client;
  directory: string;
  dryRun: boolean;
  keyFor?: (relativePath: string) => string;
  label: string;
}

export function getRepoRoot(): string {
  return repoRoot;
}

export function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

export function readFlagValue(
  args: string[],
  flag: string,
): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Flag ${flag} requires a value.`);
  }

  return value;
}

export function resolveRepoPath(inputPath: string): string {
  return path.isAbsolute(inputPath)
    ? inputPath
    : path.resolve(repoRoot, inputPath);
}

export async function assertDirectoryExists(
  directory: string,
  label: string,
): Promise<void> {
  let stats: fs.Stats;
  try {
    stats = await fs.promises.stat(directory);
  } catch {
    throw new Error(`${label} does not exist: ${directory}`);
  }

  if (!stats.isDirectory()) {
    throw new Error(`${label} is not a directory: ${directory}`);
  }
}

export async function assertFileExists(
  filePath: string,
  label: string,
): Promise<void> {
  let stats: fs.Stats;
  try {
    stats = await fs.promises.stat(filePath);
  } catch {
    throw new Error(`${label} does not exist: ${filePath}`);
  }

  if (!stats.isFile()) {
    throw new Error(`${label} is not a file: ${filePath}`);
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable ${name}.`);
  }

  return value;
}

export function createS3Client(region = DEFAULT_AWS_REGION): S3Client {
  return new S3Client({ region });
}

export function createCloudFrontClient(): CloudFrontClient {
  return new CloudFrontClient({ region: CLOUDFRONT_REGION });
}

export function createCloudFormationClient(
  region = DEFAULT_AWS_REGION,
): CloudFormationClient {
  return new CloudFormationClient({ region });
}

export function runFrontendBuild(): void {
  console.log("[publish] Building frontend bundle...");
  execSync("pnpm --filter @humpback/frontend build", {
    cwd: repoRoot,
    stdio: "inherit",
  });
}

export async function uploadDirectory(
  options: UploadDirectoryOptions,
): Promise<string[]> {
  const files = await listFiles(options.directory);
  const uploadedKeys: string[] = [];

  console.log(
    `[publish] ${options.label}: ${files.length} file(s) from ${options.directory}`,
  );

  for (const filePath of files) {
    const relativePath = path.relative(options.directory, filePath);
    const normalizedRelativePath = toPosix(relativePath);
    const key = options.keyFor
      ? options.keyFor(normalizedRelativePath)
      : normalizedRelativePath;
    const cacheControl = options.cacheControlFor(normalizedRelativePath);
    const contentType = contentTypeFor(filePath);

    uploadedKeys.push(key);

    if (options.dryRun) {
      console.log(
        `[publish] dry-run upload s3://${options.bucket}/${key} (${cacheControl})`,
      );
      continue;
    }

    await options.client.send(
      new PutObjectCommand({
        Bucket: options.bucket,
        Key: key,
        Body: fs.createReadStream(filePath),
        CacheControl: cacheControl,
        ContentType: contentType,
      }),
    );

    console.log(`[publish] uploaded s3://${options.bucket}/${key}`);
  }

  return uploadedKeys;
}

export async function invalidatePaths(options: {
  cloudFrontClient: CloudFrontClient;
  distributionId: string;
  dryRun: boolean;
  label: string;
  paths: string[];
}): Promise<void> {
  const uniquePaths = [...new Set(options.paths)].sort();

  if (uniquePaths.length === 0) {
    console.log(`[publish] ${options.label}: no invalidation needed`);
    return;
  }

  if (options.dryRun) {
    console.log(
      `[publish] dry-run invalidate ${options.distributionId}: ${uniquePaths.join(", ")}`,
    );
    return;
  }

  await options.cloudFrontClient.send(
    new CreateInvalidationCommand({
      DistributionId: options.distributionId,
      InvalidationBatch: {
        CallerReference: `${options.label}-${Date.now()}`,
        Paths: {
          Quantity: uniquePaths.length,
          Items: uniquePaths,
        },
      },
    }),
  );

  console.log(
    `[publish] submitted invalidation for ${options.distributionId}: ${uniquePaths.join(", ")}`,
  );
}

async function listFiles(directory: string): Promise<string[]> {
  const entries = await fs.promises.readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files.sort();
}

export function loadEnvFileIfPresent(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const contents = fs.readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) {
      continue;
    }

    const key = match[1];
    const rawValue = match[2] ?? "";
    if (!key) {
      continue;
    }

    if (process.env[key] !== undefined) {
      continue;
    }

    const value = stripWrappingQuotes(rawValue.trim());
    process.env[key] = value;
  }
}

export async function doesS3ObjectExist(
  client: S3Client,
  bucket: string,
  key: string,
): Promise<boolean> {
  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
    return true;
  } catch (error: unknown) {
    if (isObjectMissingError(error)) {
      return false;
    }

    throw error;
  }
}

export async function readS3ObjectText(
  client: S3Client,
  bucket: string,
  key: string,
): Promise<string | null> {
  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    if (!response.Body) {
      throw new Error(`S3 object had no response body: s3://${bucket}/${key}`);
    }

    return await bodyToString(response.Body);
  } catch (error: unknown) {
    if (isObjectMissingError(error)) {
      return null;
    }

    throw error;
  }
}

export async function describeStack(
  client: CloudFormationClient,
  stackName: string,
) {
  try {
    const response = await client.send(
      new DescribeStacksCommand({
        StackName: stackName,
      }),
    );

    return response.Stacks?.[0] ?? null;
  } catch (error: unknown) {
    if (isStackMissingError(error)) {
      return null;
    }

    throw error;
  }
}

function toPosix(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function stripWrappingQuotes(value: string): string {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

async function bodyToString(body: unknown): Promise<string> {
  if (
    typeof body === "object" &&
    body !== null &&
    "transformToString" in body &&
    typeof body.transformToString === "function"
  ) {
    return await body.transformToString();
  }

  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Buffer | string>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}

function isObjectMissingError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const metadata = error as Error & {
    $metadata?: { httpStatusCode?: number };
    name?: string;
  };

  return (
    metadata.name === "NoSuchKey" ||
    metadata.name === "NotFound" ||
    metadata.$metadata?.httpStatusCode === 404 ||
    error.message.includes("Not Found")
  );
}

function isStackMissingError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const metadata = error as Error & { name?: string };

  return (
    metadata.name === "ValidationError" &&
    error.message.includes("does not exist")
  );
}

function contentTypeFor(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".mp3":
      return "audio/mpeg";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}
