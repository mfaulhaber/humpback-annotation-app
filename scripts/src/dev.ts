import { execSync, spawn } from "node:child_process";

const API_PORT = process.env["API_PORT"] ?? "3001";
const DYNAMO_ENDPOINT =
  process.env["DYNAMODB_ENDPOINT"] ?? "http://localhost:8000";

function log(msg: string) {
  console.log(`[dev] ${msg}`);
}

function isDynamoReachable(): boolean {
  try {
    execSync(`curl -sf ${DYNAMO_ENDPOINT} -o /dev/null 2>/dev/null`, {
      stdio: "ignore",
      timeout: 3000,
    });
    return true;
  } catch {
    return false;
  }
}

function runSync(cmd: string, label: string): boolean {
  log(`Running: ${label}`);
  try {
    execSync(cmd, { stdio: "inherit", cwd: process.cwd() });
    return true;
  } catch {
    return false;
  }
}

function startProcess(
  cmd: string,
  args: string[],
  label: string,
  env?: Record<string, string>,
) {
  const proc = spawn(cmd, args, {
    stdio: "inherit",
    cwd: process.cwd(),
    env: { ...process.env, ...env },
  });
  proc.on("error", (err) => log(`${label} error: ${err.message}`));
  proc.on("exit", (code) => {
    if (code !== null && code !== 0) {
      log(`${label} exited with code ${code}`);
    }
  });
  return proc;
}

async function main() {
  log("Starting local development environment...");

  // 1. Check DynamoDB Local
  if (!isDynamoReachable()) {
    log("DynamoDB Local not reachable. Starting via docker compose...");
    if (
      !runSync("docker compose up -d", "docker compose up")
    ) {
      log("Failed to start Docker. Please start Docker and DynamoDB Local manually:");
      log("  docker compose up -d");
      process.exit(1);
    }

    // Wait briefly for DynamoDB to become ready
    log("Waiting for DynamoDB Local...");
    let ready = false;
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      if (isDynamoReachable()) {
        ready = true;
        break;
      }
    }
    if (!ready) {
      log("DynamoDB Local did not become reachable. Check Docker.");
      process.exit(1);
    }
  }
  log("DynamoDB Local is reachable.");

  // 2. Initialize tables (idempotent)
  runSync("pnpm db:local:init", "db:local:init");

  // 3. Seed data (idempotent — will write over existing data)
  if (process.argv.includes("--seed") || process.argv.includes("--force")) {
    runSync("pnpm db:local:seed", "db:local:seed");
  } else {
    log("Skipping seed (pass --seed to re-seed).");
  }

  // 4. Start API and frontend concurrently
  log(`Starting API server on port ${API_PORT}...`);
  const api = startProcess("pnpm", ["--filter", "@humpback/api", "dev"], "API");

  log("Starting frontend dev server...");
  const frontend = startProcess(
    "pnpm",
    ["--filter", "@humpback/frontend", "dev"],
    "Frontend",
  );

  // Handle shutdown
  function shutdown() {
    log("Shutting down...");
    api.kill();
    frontend.kill();
    process.exit(0);
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err: unknown) => {
  console.error("Dev startup failed:", err);
  process.exit(1);
});
