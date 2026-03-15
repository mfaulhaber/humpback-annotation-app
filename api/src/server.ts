import path from "node:path";
import fastifyStatic from "@fastify/static";
import { loadConfig } from "./config.js";
import { buildApp } from "./app.js";

const config = loadConfig();
const app = buildApp(config);

// Serve local media files in local development
if (config.appEnv === "local") {
  app.register(fastifyStatic, {
    root: path.resolve(config.mediaRoot),
    prefix: "/media/",
    decorateReply: false,
  });
}

app.listen({ port: config.apiPort, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`API server listening at ${address}`);
});
