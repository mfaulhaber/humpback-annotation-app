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

export interface ByteRange {
  start: number;
  end: number;
}

export function parseByteRange(
  headerValue: string | undefined,
  fileSize: number,
): ByteRange | null {
  if (!headerValue) {
    return null;
  }

  const match = /^bytes=(\d*)-(\d*)$/i.exec(headerValue.trim());
  if (!match) {
    return null;
  }

  const rawStart = match[1] ?? "";
  const rawEnd = match[2] ?? "";

  if (rawStart === "" && rawEnd === "") {
    return null;
  }

  if (rawStart === "") {
    const suffixLength = Number.parseInt(rawEnd, 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null;
    }

    const start = Math.max(fileSize - suffixLength, 0);
    return {
      start,
      end: fileSize - 1,
    };
  }

  const start = Number.parseInt(rawStart, 10);
  const requestedEnd =
    rawEnd === "" ? fileSize - 1 : Number.parseInt(rawEnd, 10);

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(requestedEnd) ||
    start < 0 ||
    requestedEnd < start ||
    start >= fileSize
  ) {
    return null;
  }

  return {
    start,
    end: Math.min(requestedEnd, fileSize - 1),
  };
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

      res.setHeader("Content-Type", contentTypeFor(filePath));
      res.setHeader("Accept-Ranges", "bytes");

      const range = parseByteRange(req.headers.range, stats.size);
      if (req.headers.range && !range) {
        res.statusCode = 416;
        res.setHeader("Content-Range", `bytes */${stats.size}`);
        res.end();
        return;
      }

      if (range) {
        res.statusCode = 206;
        res.setHeader(
          "Content-Range",
          `bytes ${range.start}-${range.end}/${stats.size}`,
        );
        res.setHeader("Content-Length", range.end - range.start + 1);
        fs.createReadStream(filePath, {
          start: range.start,
          end: range.end,
        }).pipe(res);
        return;
      }

      res.statusCode = 200;
      res.setHeader("Content-Length", stats.size);
      fs.createReadStream(filePath).pipe(res);
    });
  }

  function useTimelineDataMiddleware(server: {
    middlewares: { use: (fn: typeof serveTimelineData) => void };
  }) {
    server.middlewares.use(serveTimelineData);
  }

  return {
    name: "timeline-export-root",
    configureServer(server: { middlewares: { use: (fn: typeof serveTimelineData) => void } }) {
      useTimelineDataMiddleware(server);
    },
    configurePreviewServer(server: {
      middlewares: { use: (fn: typeof serveTimelineData) => void };
    }) {
      useTimelineDataMiddleware(server);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, "");
  const frontendPort = parseInt(env["FRONTEND_PORT"] ?? "6173", 10);
  const previewPort = parseInt(
    env["FRONTEND_PREVIEW_PORT"] ??
      process.env["FRONTEND_PREVIEW_PORT"] ??
      "4173",
    10,
  );
  const apiPort = env["API_PORT"] ?? "3001";
  const timelineExportRoot =
    env["TIMELINE_EXPORT_ROOT"] ?? process.env["TIMELINE_EXPORT_ROOT"];

  return {
    plugins: [react(), timelineExportPlugin(timelineExportRoot)],
    preview: {
      port: previewPort,
    },
    server: {
      port: frontendPort,
      proxy: {
        "/api": `http://localhost:${apiPort}`,
        "/media": `http://localhost:${apiPort}`,
      },
    },
  };
});
