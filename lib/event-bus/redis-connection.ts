import { logger } from "@/lib/logger";
// Named import, bukan default: ioredis adalah modul CommonJS dan interop
// default-import-nya pecah setelah minifikasi webpack ("is not a constructor").
import { Redis } from "ioredis";
import { DEFAULT_LOCAL_REDIS_URL, redisOptionsFromUrl } from "@/lib/redis-url";

const REDIS_URL = process.env.REDIS_URL ?? DEFAULT_LOCAL_REDIS_URL;

/**
 * Create Redis connection for BullMQ workers.
 * Handles connection retry, error handling, and event logging.
 */
export function createWorkerRedis(): Redis {
  // redisOptionsFromUrl memakai WHATWG URL (bukan url.parse ioredis, DEP0169),
  // membuang ?family=undefined dari env Next.js, dan tidak mengirim auth kosong.
  const conn = new Redis({
    ...redisOptionsFromUrl(REDIS_URL),
    maxRetriesPerRequest: null,
    enableOfflineQueue: true,
    retryStrategy: (times) => {
      const delay = Math.min(times * 1000, 10000);
      if (times <= 3) {
        logger.warn(
          `[Redis] Reconnection attempt ${times}, retrying in ${delay}ms`,
        );
      }
      if (times > 20) {
        logger.error("[Redis] Max reconnection attempts reached, giving up");
        return null;
      }
      return delay;
    },
    reconnectOnError: (err) => {
      const targetErrors = ["READONLY", "ECONNRESET", "ETIMEDOUT"];
      if (targetErrors.some((e) => err.message.includes(e))) {
        logger.warn(`[Redis] Reconnecting due to error: ${err.message}`);
        return true;
      }
      return false;
    },
    lazyConnect: false,
    keepAlive: 30000,
    connectTimeout: 10000,
    // Remove commandTimeout - BullMQ's BRPOPLPUSH needs to block indefinitely
    // commandTimeout: 5000,
  });

  conn.on("error", (err) => {
    // Only log non-timeout errors to reduce noise
    if (!err.message.includes("Command timed out")) {
      logger.error("[Redis] Connection error:", err.message);
    }
  });

  conn.on("connect", () => {
    logger.info("[Redis] Connected successfully");
  });

  conn.on("ready", () => {
    logger.info("[Redis] Ready to accept commands");
  });

  conn.on("close", () => {
    logger.warn("[Redis] Connection closed");
  });

  conn.on("reconnecting", () => {
    logger.info("[Redis] Attempting to reconnect...");
  });

  return conn;
}
