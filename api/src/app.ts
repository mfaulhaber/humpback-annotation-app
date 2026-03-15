import Fastify from "fastify";
import cors from "@fastify/cors";
import type { Config } from "./config.js";
import { getDocClient } from "./lib/dynamo-client.js";
import authPlugin from "./plugins/auth.js";
import catalogRoutes from "./routes/catalog.js";
import annotationRoutes from "./routes/annotation.js";
import suggestionRoutes from "./routes/suggestion.js";
import adminRoutes from "./routes/admin.js";

export function buildApp(config: Config) {
  const app = Fastify({ logger: true });
  const docClient = getDocClient(config);

  app.register(cors, { origin: true });

  // Health check — no auth required
  app.get("/health", async () => ({ status: "ok" }));

  // All /api routes require authentication
  app.register(
    async (apiScope) => {
      apiScope.register(authPlugin, { config });
      apiScope.register(catalogRoutes, { config, docClient });
      apiScope.register(annotationRoutes, { config, docClient });
      apiScope.register(suggestionRoutes, { config, docClient });
      apiScope.register(adminRoutes, { config, docClient });
    },
  );

  return app;
}
