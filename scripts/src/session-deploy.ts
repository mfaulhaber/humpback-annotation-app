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
  doesS3ObjectExist,
  getRepoRoot,
  hasFlag,
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
  outcome: "ran" | "skipped";
  reason?: string;
}

interface DataPublishDecision {
  reason: string;
  shouldPublish: boolean;
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

async function decideDataPublish(
  exportRoot: string,
  dataBucketName: string,
  region: string,
): Promise<DataPublishDecision> {
  const localJobIds = await validateLocalExportRoot(exportRoot);

  const localIndexRaw = await fs.promises.readFile(
    path.join(exportRoot, "index.json"),
    "utf8",
  );
  const localIndexNormalized = normalizeJson(JSON.parse(localIndexRaw));
  const s3Client = createS3Client(region);
  const remoteIndexRaw = await readS3ObjectText(s3Client, dataBucketName, "index.json");

  if (!remoteIndexRaw) {
    return {
      reason: "remote index.json is missing",
      shouldPublish: true,
    };
  }

  let remoteIndexNormalized: string;
  try {
    remoteIndexNormalized = normalizeJson(JSON.parse(remoteIndexRaw));
  } catch {
    return {
      reason: "remote index.json is unreadable",
      shouldPublish: true,
    };
  }

  const missingJobIds = (
    await Promise.all(
      localJobIds.map(async (jobId) => {
        const exists = await doesS3ObjectExist(
          s3Client,
          dataBucketName,
          `${jobId}/manifest.json`,
        );

        return exists ? null : jobId;
      }),
    )
  ).filter((jobId): jobId is string => jobId !== null);

  if (missingJobIds.length > 0) {
    return {
      reason: `missing remote manifest(s) for ${missingJobIds.join(", ")}`,
      shouldPublish: true,
    };
  }

  if (remoteIndexNormalized !== localIndexNormalized) {
    return {
      reason: "local index.json differs from the deployed copy",
      shouldPublish: true,
    };
  }

  return {
    reason: `remote data already contains all ${localJobIds.length} local job(s)`,
    shouldPublish: false,
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
  const forceData = hasFlag(args, "--force-data");
  const skipData = hasFlag(args, "--skip-data");
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
        label: "data publish",
        outcome: "skipped",
        reason: skipData
          ? "--skip-data was set"
          : forceData
            ? "dry run: would publish data after the initial stack deploy because --force-data was set"
            : "dry run: would evaluate and publish data after the initial stack deploy",
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
      label: "data publish",
      outcome: "skipped",
      reason: "--skip-data was set",
    });
    printSummary(steps, outputs);
    return;
  }

  if (!exportRoot) {
    steps.push({
      label: "data publish",
      outcome: "skipped",
      reason: "no export root was provided",
    });
    printSummary(steps, outputs);
    return;
  }

  const dataDecision = forceData
    ? {
        reason: "--force-data was set",
        shouldPublish: true,
      }
    : await decideDataPublish(exportRoot, outputs.dataBucketName, region);

  if (!dataDecision.shouldPublish) {
    steps.push({
      label: "data publish",
      outcome: "skipped",
      reason: dataDecision.reason,
    });
    printSummary(steps, outputs);
    return;
  }

  const dataArgs = ["publish:viewer:data", "--", "--path", exportRoot];
  if (dryRun) {
    dataArgs.push("--dry-run");
  }
  runCommand("pnpm", dataArgs, "pnpm publish:viewer:data", publishEnv);
  steps.push({
    label: "data publish",
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
