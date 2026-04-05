import fs from "node:fs";
import type { ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Connect } from "vite";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolvePathWithinRoot } from "./dev-server-paths.js";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(configDir, "..");

function contentTypeFor(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case ".json":
      return "application/json; charset=utf-8";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".mp3":
      return "audio/mpeg";
    default:
      return "application/octet-stream";
  }
}

function timelineExportPlugin(timelineExportRoot: string | undefined) {
  const resolvedRoot = timelineExportRoot
    ? path.resolve(timelineExportRoot)
    : null;

  function serveTimelineData(
    req: Connect.IncomingMessage,
    res: ServerResponse,
    next: Connect.NextFunction,
  ) {
    if (!req.url?.startsWith("/data")) {
      next();
      return;
    }

    if (!resolvedRoot) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end(
        "TIMELINE_EXPORT_ROOT is not set. Point it at a local export directory containing index.json and job folders.",
      );
      return;
    }

    const relativePath = decodeURIComponent(req.url.replace(/^\/data\/?/, ""));
    const requestedPath = relativePath.length > 0 ? relativePath : "index.json";
    const filePath = resolvePathWithinRoot(resolvedRoot, requestedPath);

    if (!filePath) {
      res.statusCode = 403;
      res.end("Forbidden");
      return;
    }

    fs.stat(filePath, (error, stats) => {
      if (error || !stats.isFile()) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end(`Timeline artifact not found: ${requestedPath}`);
        return;
      }

      res.statusCode = 200;
      res.setHeader("Content-Type", contentTypeFor(filePath));
      fs.createReadStream(filePath).pipe(res);
    });
  }

  return {
    name: "timeline-export-root",
    configureServer(server: { middlewares: { use: (fn: typeof serveTimelineData) => void } }) {
      server.middlewares.use(serveTimelineData);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, "");
  const frontendPort = parseInt(env["FRONTEND_PORT"] ?? "6173", 10);
  const apiPort = env["API_PORT"] ?? "3001";
  const timelineExportRoot = env["TIMELINE_EXPORT_ROOT"];

  return {
    plugins: [react(), timelineExportPlugin(timelineExportRoot)],
    server: {
      port: frontendPort,
      proxy: {
        "/api": `http://localhost:${apiPort}`,
        "/media": `http://localhost:${apiPort}`,
      },
    },
  };
});
