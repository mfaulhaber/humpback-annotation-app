import type { Config } from "../config.js";

export function resolveMediaUrl(config: Config, key: string): string {
  if (config.appEnv === "local") {
    return `http://localhost:${config.apiPort}/media/${key}`;
  }

  // Future: return CDN URL for cloud environments
  return `/media/${key}`;
}
