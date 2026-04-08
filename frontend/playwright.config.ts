import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import {
  frontendRoot,
  resolveUiTestMode,
  resolveUiTestExportRoot,
} from "./tests/ui/helpers/export-root.js";

const previewPort = Number.parseInt(
  process.env["FRONTEND_PREVIEW_PORT"] ?? "4173",
  10,
);
const uiTestMode = resolveUiTestMode();
const exportRoot = resolveUiTestExportRoot(uiTestMode);

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

export default defineConfig({
  testDir: path.join(frontendRoot, "tests", "ui"),
  timeout: 30_000,
  fullyParallel: false,
  retries: process.env["CI"] ? 1 : 0,
  reporter: "list",
  outputDir: path.join(frontendRoot, "test-results", "playwright"),
  use: {
    baseURL: `http://127.0.0.1:${previewPort}`,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    viewport: {
      width: 1440,
      height: 960,
    },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        browserName: "chromium",
        viewport: {
          width: 1440,
          height: 960,
        },
      },
    },
  ],
  webServer: {
    command:
      "pnpm build && " +
      `TIMELINE_EXPORT_ROOT=${shellEscape(exportRoot)} ` +
      `FRONTEND_PREVIEW_PORT=${previewPort} ` +
      "pnpm exec vite preview --host 127.0.0.1 --port " +
      previewPort,
    cwd: frontendRoot,
    reuseExistingServer: false,
    timeout: 120_000,
    url: `http://127.0.0.1:${previewPort}`,
  },
});
