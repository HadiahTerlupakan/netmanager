import { logger } from "@/lib/logger";
import Redis from "ioredis";

const DEFAULT_LOCAL_REDIS_URL = "redis://localhost:6379";
const REDIS_URL = process.env.REDIS_URL ?? DEFAULT_LOCAL_REDIS_URL;

/**
 * Create Redis connection for BullMQ workers.
 * Handles connection retry, error handling, and event logging.
 */
export function createWorkerRedis(): Redis {
  // Parse URL and clean up malformed query params (e.g., ?family=undefined from Next.js env)
  let url = REDIS_URL;
  try {
    const parsed = new URL(REDIS_URL);
    if (parsed.searchParams.has("family")) {
      parsed.searchParams.delete("family");
    }
    // If password is empty string, remove auth part to avoid NOAUTH errors
    if (!parsed.password) {
      parsed.username = "";
    }
    url = parsed.toString().replace(/\?$/, ""); // Remove trailing ? if no params
  } catch {
    // Use URL as-is if parsing fails
  }

  const conn = new Redis(url, {
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
