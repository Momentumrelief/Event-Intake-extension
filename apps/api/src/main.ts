import { buildApp } from "./app.js";
import { startSyncWorker } from "./modules/sync/worker.js";
import { closeRedis } from "./lib/redis.js";
import { prisma } from "./lib/prisma.js";

const PORT = parseInt(process.env["PORT"] ?? "3000");
const HOST = process.env["HOST"] ?? "0.0.0.0";

async function main() {
  const app = await buildApp();

  // Try to start the sync worker. If Redis is unavailable this will fail
  // silently — EHR sync is disabled but lead capture and review still work.
  let worker: Awaited<ReturnType<typeof startSyncWorker>> | null = null;
  try {
    worker = startSyncWorker();
    app.log.info("Sync worker started (Redis connected).");
  } catch {
    app.log.warn("Redis not available — EHR sync worker disabled. Lead capture and review work normally.");
  }

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down...`);
    await app.close();
    if (worker) await worker.close();
    await closeRedis();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`API listening at http://localhost:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
