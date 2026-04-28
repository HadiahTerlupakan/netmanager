import "dotenv/config";
import { cronRegistry } from "./lib/cron-registry";
import { startInternalCronIfEnabled } from "./lib/runtime/should-start-internal-cron";
import { initializeEventBus, shutdownEventBus } from "./lib/event-bus";
import { logger } from "./lib/logger";

// Safeguard: Set Default Timezone for the entire process if not set
if (!process.env.TZ) {
  process.env.TZ = "Asia/Jakarta";
}
logger.info(
  `[Worker] Starting background worker... Timezone: ${process.env.TZ} (${new Date().toString()})`,
);

// Start all cron jobs
startInternalCronIfEnabled({ startAll: () => cronRegistry.startAll() });

// Start Event Bus (BullMQ workers + Outbox processor)
initializeEventBus().catch((err) =>
  logger.error("[Worker] Failed to initialize Event Bus:", err),
);

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`[Worker] ${signal} received, shutting down gracefully`);

  // 1. Stop Event Bus
  try {
    await shutdownEventBus();
    logger.info("[Worker] Event Bus stopped");
  } catch (e) {
    logger.error("[Worker] Error stopping Event Bus:", e);
  }

  // 2. Stop Cron Jobs
  cronRegistry.stopAll();

  // Give some time for tasks to stop if needed
  setTimeout(() => {
    process.exit(0);
  }, 2000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
