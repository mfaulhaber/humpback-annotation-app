import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type UiTestMode = "fixture" | "smoke";

export const committedFixtureJobId =
  "8224c4a6-bc36-43db-ad59-e8933ef09115";
export const committedFixtureStartTimestamp = 1_635_465_600;
export const committedFixtureEndTimestamp = 1_635_552_000;
export const committedFixtureHotspotTimestamp = 1_635_473_100;

const currentFileDir = path.dirname(fileURLToPath(import.meta.url));

export const frontendRoot = path.resolve(currentFileDir, "..", "..", "..");

export function resolveUiTestMode(
  rawMode: string | undefined = process.env["PLAYWRIGHT_UI_MODE"],
): UiTestMode {
  return rawMode === "smoke" ? "smoke" : "fixture";
}

export function resolveCommittedFixtureExportRoot(): string {
  return path.join(frontendRoot, "test-data", "timeline-export");
}

function assertExportRootExists(root: string, label: string): string {
  const resolvedRoot = path.resolve(root);
  const indexPath = path.join(resolvedRoot, "index.json");

  if (!fs.existsSync(indexPath)) {
    throw new Error(
      `${label} is missing index.json: ${indexPath}`,
    );
  }

  return resolvedRoot;
}

export function resolveUiTestExportRoot(mode: UiTestMode): string {
  if (mode === "smoke") {
    const configuredRoot = process.env["TIMELINE_EXPORT_ROOT"];

    if (!configuredRoot) {
      throw new Error(
        "TIMELINE_EXPORT_ROOT must be set for UI smoke tests.",
      );
    }

    return assertExportRootExists(configuredRoot, "UI smoke export root");
  }

  return assertExportRootExists(
    resolveCommittedFixtureExportRoot(),
    "Committed UI fixture export root",
  );
}
