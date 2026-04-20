import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import fp from "fastify-plugin";
import { authRoutes } from "./modules/auth/routes.js";
import { eventRoutes } from "./modules/events/routes.js";
import { leadRoutes } from "./modules/leads/routes.js";
import { consentRoutes } from "./modules/consent/routes.js";
import { ehrRoutes } from "./modules/ehr/routes.js";
import { syncRoutes } from "./modules/sync/routes.js";
import { exportRoutes } from "./modules/export/routes.js";
import { AppError } from "./lib/errors.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; email: string };
    user: { sub: string; email: string };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) => Promise<void>;
  }
}

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env["NODE_ENV"] === "production" ? "warn" : "info",
      // Redact sensitive fields from logs
      redact: ["req.headers.authorization", "*.password", "*.passwordHash", "*.encryptedTokens"],
    },
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: (process.env["CORS_ORIGINS"] ?? "http://localhost:5173").split(","),
    credentials: true,
  });
  await app.register(rateLimit, { max: 200, timeWindow: "1 minute" });
  await app.register(sensible);
  await app.register(jwt, {
    secret: process.env["JWT_SECRET"] ?? "dev-secret-change-in-production",
  });

  // Auth decorator
  await app.register(
    fp(async (fastify) => {
      fastify.decorate(
        "authenticate",
        async (req: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) => {
          try {
            await req.jwtVerify();
          } catch {
            reply.status(401).send({ error: "Unauthorized" });
          }
        },
      );
    }),
  );

  // Global error handler
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: error.message,
        code: error.code,
      });
    }
    app.log.error(error);
    return reply.status(500).send({ error: "Internal server error" });
  });

  // Health check
  app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  // Register route modules
  await app.register(authRoutes);
  await app.register(eventRoutes);
  await app.register(leadRoutes);
  await app.register(consentRoutes);
  await app.register(ehrRoutes);
  await app.register(syncRoutes);
  await app.register(exportRoutes);

  return app;
}
