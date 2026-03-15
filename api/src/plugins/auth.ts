import type { FastifyInstance, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import type { Config } from "../config.js";

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
    userRole: "annotator" | "admin";
  }
}

async function authPlugin(
  fastify: FastifyInstance,
  opts: { config: Config },
): Promise<void> {
  fastify.decorateRequest("userId", "");
  fastify.decorateRequest("userRole", "annotator" as const);

  fastify.addHook("onRequest", async (request, reply) => {
    if (opts.config.authMode === "dev") {
      const userId = request.headers["x-dev-user"] as string | undefined;
      const role = request.headers["x-dev-role"] as string | undefined;

      if (!userId) {
        return reply.code(401).send({ error: "Missing x-dev-user header" });
      }

      request.userId = userId;
      request.userRole = role === "admin" ? "admin" : "annotator";
      return;
    }

    // Future: cognito JWT validation
    return reply.code(401).send({ error: "Auth mode not supported" });
  });
}

export default fp(authPlugin, { name: "auth" });
