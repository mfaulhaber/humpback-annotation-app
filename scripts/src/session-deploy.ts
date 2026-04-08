import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { Stack } from "@aws-sdk/client-cloudformation";
import {
  DEFAULT_AWS_REGION,
  assertDirectoryExists,
  assertFileExists,
  createCloudFormationClient,
  createS3Client,
  describeStack,
  getRepoRoot,
  hasFlag,
  listS3Objects,
  loadEnvFileIfPresent,
  readFlagValue,
  readS3ObjectText,
  resolveRepoPath,
} from "./publish-support.js";

const DEFAULT_STACK_NAME = "humpback-static-viewer";
const REPO_ROOT = getRepoRoot();
const REQUIRED_OUTPUT_KEYS = {
  appBucketName: "StaticViewerAppBucketName",
  dataBucketName: "StaticViewerDataBucketName",
  distributionId: "StaticViewerDistributionId",
  url: "StaticViewerUrl",
  dataUrl: "StaticViewerDataUrl",
} as const;

interface TimelineIndex {
  timelines: TimelineEntry[];
}

interface TimelineEntry {
  job_id: string;
}

interface DeployOutputs {
  appBucketName: string;
  dataBucketName: string;
  distributionId: string;
  url?: string;
  dataUrl?: string;
}

interface StepResult {
  label: string;
  outcome: "failed" | "ran" | "skipped";
  reason?: string;
}

interface DataVerificationDecision {
  matches: boolean;
  reason: string;
}

function log(message: string): void {
  console.log(`[deploy] ${message}`);
}

function readCurrentBranch(): string {
  return captureCommand("git", ["branch", "--show-current"], "git branch")
    .stdout.trim();
}

function readGitStatus(): string {
  return captureCommand("git", ["status", "--porcelain"], "git status").stdout;
}

function ensureDeployableGitState(allowDirty: boolean): void {
  const branch = readCurrentBranch();
  if (!branch) {
    throw new Error("HEAD is detached. Switch to a branch before deploying.");
  }

  const status = readGitStatus();
  if (status && !allowDirty) {
    throw new Error(
      "Working tree is dirty. Commit or stash changes first, or rerun with --allow-dirty if you intentionally want to deploy uncommitted work.",
    );
  }

  if (status && allowDirty) {
    log("Continuing with a dirty working tree because --allow-dirty was set.");
  }
}

function runCommand(
  executable: string,
  args: string[],
  label: string,
  env?: NodeJS.ProcessEnv,
): void {
  log(`Running ${label}...`);
  const result = spawnSync(executable, args, {
    cwd: REPO_ROOT,
    env: env ? { ...process.env, ...env } : process.env,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 1}.`);
  }
}

function captureCommand(
  executable: string,
  args: string[],
  label: string,
  env?: NodeJS.ProcessEnv,
): { status: number; stdout: string; stderr: string } {
  const result = spawnSync(executable, args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: env ? { ...process.env, ...env } : process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status === null) {
    throw new Error(`${label} terminated unexpectedly.`);
  }

  return {
    status: result.status,
    stderr: result.stderr ?? "",
    stdout: result.stdout ?? "",
  };
}

function resolveStackName(): string {
  return process.env["STATIC_VIEWER_STACK_NAME"]?.trim() ?? DEFAULT_STACK_NAME;
}

function resolveAwsRegion(): string {
  return process.env["AWS_REGION"]?.trim() ?? DEFAULT_AWS_REGION;
}

async function resolveDeployOutputs(
  stackName: string,
  region: string,
): Promise<DeployOutputs | null> {
  const cloudFormationClient = createCloudFormationClient(region);
  const stack = await describeStack(cloudFormationClient, stackName);

  if (!stack) {
    return null;
  }

  return requiredOutputsFromStack(stack, stackName);
}

function requiredOutputsFromStack(stack: Stack, stackName: string): DeployOutputs {
  const outputMap = new Map(
    (stack.Outputs ?? [])
      .filter((output) => output.OutputKey && output.OutputValue)
      .map((output) => [output.OutputKey as string, output.OutputValue as string]),
  );

  const appBucketName = outputMap.get(REQUIRED_OUTPUT_KEYS.appBucketName);
  const dataBucketName = outputMap.get(REQUIRED_OUTPUT_KEYS.dataBucketName);
  const distributionId = outputMap.get(REQUIRED_OUTPUT_KEYS.distributionId);

  if (!appBucketName || !dataBucketName || !distributionId) {
    throw new Error(
      `Stack ${stackName} is missing one or more required outputs (${REQUIRED_OUTPUT_KEYS.appBucketName}, ${REQUIRED_OUTPUT_KEYS.dataBucketName}, ${REQUIRED_OUTPUT_KEYS.distributionId}).`,
    );
  }

  const outputs: DeployOutputs = {
    appBucketName,
    dataBucketName,
    distributionId,
  };
  const url = outputMap.get(REQUIRED_OUTPUT_KEYS.url);
  const dataUrl = outputMap.get(REQUIRED_OUTPUT_KEYS.dataUrl);

  if (url) {
    outputs.url = url;
  }

  if (dataUrl) {
    outputs.dataUrl = dataUrl;
  }

  return outputs;
}

function hasInfrastructureChanges(): boolean {
  const result = captureCommand(
    "pnpm",
    ["cdk:diff"],
    "pnpm cdk:diff",
    { NO_COLOR: "1" },
  );

  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);

  if (result.status !== 0) {
    throw new Error(`pnpm cdk:diff failed with exit code ${result.status}.`);
  }

  return !`${result.stdout}\n${result.stderr}`.includes("There were no differences");
}

async function resolveExportRoot(skipData: boolean): Promise<string | null> {
  const exportRootArg =
    readFlagValue(process.argv.slice(2), "--path") ??
    process.env["TIMELINE_EXPORT_ROOT"];

  if (!exportRootArg) {
    if (skipData) {
      return null;
    }

    throw new Error(
      "Provide --path <export-root>, set TIMELINE_EXPORT_ROOT, or pass --skip-data for an app-only deploy.",
    );
  }

  const exportRoot = resolveRepoPath(exportRootArg);
  await assertDirectoryExists(exportRoot, "Timeline export root");
  await assertFileExists(
    path.join(exportRoot, "index.json"),
    "Timeline export index.json",
  );

  return exportRoot;
}

async function readLocalTimelineIndex(exportRoot: string): Promise<TimelineIndex> {
  const filePath = path.join(exportRoot, "index.json");
  const payload = JSON.parse(await fs.promises.readFile(filePath, "utf8")) as unknown;

  if (
    typeof payload !== "object" ||
    payload === null ||
    !Array.isArray((payload as Record<string, unknown>)["timelines"])
  ) {
    throw new Error(`Timeline export index.json is invalid: ${filePath}`);
  }

  const timelines = (payload as { timelines: unknown[] }).timelines;
  const entries = timelines.map((entry: unknown) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      typeof (entry as Record<string, unknown>)["job_id"] !== "string"
    ) {
      throw new Error(`Timeline export index contains an invalid timeline entry: ${filePath}`);
    }

    const jobId = (entry as Record<string, unknown>)["job_id"];
    return { job_id: jobId as string };
  });

  return { timelines: entries };
}

async function ensureLocalManifestsExist(
  exportRoot: string,
  jobIds: string[],
): Promise<void> {
  await Promise.all(
    jobIds.map((jobId) =>
      assertFileExists(
        path.join(exportRoot, jobId, "manifest.json"),
        `Timeline manifest for ${jobId}`,
      ),
    ),
  );
}

async function validateLocalExportRoot(exportRoot: string): Promise<string[]> {
  const localIndex = await readLocalTimelineIndex(exportRoot);
  const localJobIds = [...new Set(localIndex.timelines.map((timeline) => timeline.job_id))];
  await ensureLocalManifestsExist(exportRoot, localJobIds);
  return localJobIds;
}

function normalizeJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => normalizeJson(entry)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) => left.localeCompare(right),
    );

    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${normalizeJson(entryValue)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

async function listLocalExportObjects(
  exportRoot: string,
): Promise<Array<{ key: string; size: number }>> {
  const objects: Array<{ key: string; size: number }> = [];

  async function walk(currentDirectory: string): Promise<void> {
    const entries = await fs.promises.readdir(currentDirectory, {
      withFileTypes: true,
    });

    for (const entry of entries) {
      if (entry.name.startsWith(".")) {
        continue;
      }

      const absolutePath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const stats = await fs.promises.stat(absolutePath);
      const relativePath = path.relative(exportRoot, absolutePath).split(path.sep).join("/");
      objects.push({
        key: relativePath,
        size: stats.size,
      });
    }
  }

  await walk(exportRoot);
  return objects.sort((left, right) => left.key.localeCompare(right.key));
}

function summarizeKeys(label: string, keys: string[], maxKeys = 5): string | null {
  if (keys.length === 0) {
    return null;
  }

  const sample = keys.slice(0, maxKeys).join(", ");
  const suffix = keys.length > maxKeys ? `, +${keys.length - maxKeys} more` : "";
  return `${label}: ${sample}${suffix}`;
}

async function verifyDataParity(
  exportRoot: string,
  dataBucketName: string,
  region: string,
): Promise<DataVerificationDecision> {
  await validateLocalExportRoot(exportRoot);

  const localObjects = await listLocalExportObjects(exportRoot);
  const localMap = new Map(localObjects.map((object) => [object.key, object]));
  const s3Client = createS3Client(region);
  const remoteObjects = await listS3Objects(s3Client, dataBucketName);
  const remoteMap = new Map(remoteObjects.map((object) => [object.key, object]));

  const missingRemoteKeys = localObjects
    .filter((object) => !remoteMap.has(object.key))
    .map((object) => object.key);
  const extraRemoteKeys = remoteObjects
    .filter((object) => !localMap.has(object.key))
    .map((object) => object.key);
  const sizeMismatches = localObjects
    .filter((object) => {
      const remote = remoteMap.get(object.key);
      return remote && remote.size !== object.size;
    })
    .map((object) => {
      const remote = remoteMap.get(object.key);
      return `${object.key} (local ${object.size}, remote ${remote?.size ?? 0})`;
    });

  const jsonContentMismatches: string[] = [];
  for (const object of localObjects) {
    if (!object.key.endsWith(".json") || missingRemoteKeys.includes(object.key)) {
      continue;
    }

    const remoteText = await readS3ObjectText(s3Client, dataBucketName, object.key);
    if (remoteText === null) {
      continue;
    }

    const localText = await fs.promises.readFile(path.join(exportRoot, object.key), "utf8");
    try {
      const normalizedLocal = normalizeJson(JSON.parse(localText));
      const normalizedRemote = normalizeJson(JSON.parse(remoteText));
      if (normalizedLocal !== normalizedRemote) {
        jsonContentMismatches.push(object.key);
      }
    } catch {
      if (localText !== remoteText) {
        jsonContentMismatches.push(object.key);
      }
    }
  }

  const mismatchParts = [
    summarizeKeys("missing remote keys", missingRemoteKeys),
    summarizeKeys("extra remote keys", extraRemoteKeys),
    summarizeKeys("size mismatches", sizeMismatches),
    summarizeKeys("json content mismatches", jsonContentMismatches),
  ].filter((part): part is string => part !== null);

  if (mismatchParts.length > 0) {
    return {
      matches: false,
      reason: mismatchParts.join("; "),
    };
  }

  return {
    matches: true,
    reason: `bucket matches local export root across ${localObjects.length} file(s)`,
  };
}

function printSummary(steps: StepResult[], outputs: DeployOutputs | null): void {
  log("Summary:");
  for (const step of steps) {
    const reason = step.reason ? ` (${step.reason})` : "";
    console.log(`- ${step.label}: ${step.outcome}${reason}`);
  }

  if (outputs?.url) {
    console.log(`- viewer URL: ${outputs.url}`);
  }

  if (outputs?.dataUrl) {
    console.log(`- data URL: ${outputs.dataUrl}`);
  }
}

async function main(): Promise<void> {
  loadEnvFileIfPresent(resolveRepoPath(".env.deploy"));

  const args = process.argv.slice(2);
  const allowDirty = hasFlag(args, "--allow-dirty");
  const dryRun = hasFlag(args, "--dry-run");
  const skipData = hasFlag(args, "--skip-data");

  if (hasFlag(args, "--force-data")) {
    throw new Error(
      "--force-data is no longer supported. session-deploy now verifies bucket parity only; use `pnpm upload:viewer:missing` for manual data uploads.",
    );
  }

  const region = resolveAwsRegion();
  const stackName = resolveStackName();
  const steps: StepResult[] = [];
  const exportRoot = await resolveExportRoot(skipData);

  ensureDeployableGitState(allowDirty);

  if (exportRoot) {
    await validateLocalExportRoot(exportRoot);
  }

  log(`AWS region: ${region}`);
  log(`Stack name: ${stackName}`);
  if (dryRun) {
    log("Dry run enabled. AWS writes will be skipped where possible.");
  }

  runCommand("pnpm", ["cdk:synth"], "pnpm cdk:synth");
  steps.push({ label: "cdk synth", outcome: "ran" });

  let outputs = await resolveDeployOutputs(stackName, region);
  if (!outputs) {
    if (dryRun) {
      steps.push({
        label: "cdk deploy",
        outcome: "skipped",
        reason: `dry run: stack ${stackName} does not exist and would be created`,
      });
      steps.push({
        label: "app publish",
        outcome: "skipped",
        reason: "dry run: waits for the initial stack deploy outputs",
      });
      steps.push({
        label: "data verification",
        outcome: "skipped",
        reason: skipData
          ? "--skip-data was set"
          : "dry run: would verify export parity after the initial stack deploy",
      });
      printSummary(steps, null);
      return;
    }

    runCommand("pnpm", ["cdk:deploy"], "pnpm cdk:deploy");
    steps.push({
      label: "cdk deploy",
      outcome: "ran",
      reason: `created stack ${stackName}`,
    });
    outputs = await resolveDeployOutputs(stackName, region);
  } else {
    if (hasInfrastructureChanges()) {
      if (dryRun) {
        steps.push({
          label: "cdk deploy",
          outcome: "skipped",
          reason: "dry run: infrastructure diff detected",
        });
      } else {
        runCommand("pnpm", ["cdk:deploy"], "pnpm cdk:deploy");
        steps.push({
          label: "cdk deploy",
          outcome: "ran",
          reason: "infrastructure diff detected",
        });
        outputs = await resolveDeployOutputs(stackName, region);
      }
    } else {
      steps.push({
        label: "cdk deploy",
        outcome: "skipped",
        reason: "stack is already current",
      });
    }
  }

  if (!outputs) {
    throw new Error(
      `Could not resolve deploy outputs for stack ${stackName} after the infrastructure step.`,
    );
  }

  const publishEnv = {
    AWS_REGION: region,
    STATIC_VIEWER_APP_BUCKET_NAME: outputs.appBucketName,
    STATIC_VIEWER_DATA_BUCKET_NAME: outputs.dataBucketName,
    STATIC_VIEWER_DISTRIBUTION_ID: outputs.distributionId,
  };

  const appArgs = ["publish:viewer:app"];
  if (dryRun) {
    appArgs.push("--", "--dry-run");
  }
  runCommand("pnpm", appArgs, "pnpm publish:viewer:app", publishEnv);
  steps.push({
    label: "app publish",
    outcome: "ran",
    ...(dryRun
      ? { reason: "dry-run upload and invalidation preview" }
      : {}),
  });

  if (skipData) {
    steps.push({
      label: "data verification",
      outcome: "skipped",
      reason: "--skip-data was set",
    });
    printSummary(steps, outputs);
    return;
  }

  if (!exportRoot) {
    steps.push({
      label: "data verification",
      outcome: "skipped",
      reason: "no export root was provided",
    });
    printSummary(steps, outputs);
    return;
  }

  const dataDecision = await verifyDataParity(exportRoot, outputs.dataBucketName, region);

  if (!dataDecision.matches) {
    steps.push({
      label: "data verification",
      outcome: "failed",
      reason: dataDecision.reason,
    });
    printSummary(steps, outputs);
    throw new Error(
      `Data bucket does not match the local export root. ${dataDecision.reason}. Use \`pnpm upload:viewer:missing\` to upload missing objects, use \`pnpm publish:viewer:data -- --path ${exportRoot}\` when existing remote objects need to be overwritten to match local data, and remove any extra remote keys before rerunning session-deploy.`,
    );
  }

  steps.push({
    label: "data verification",
    outcome: "ran",
    reason: dataDecision.reason,
  });

  printSummary(steps, outputs);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[deploy] Failed: ${message}`);
  process.exit(1);
});
