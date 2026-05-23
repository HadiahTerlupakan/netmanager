import { logger } from "@/lib/logger";
import Redis from "ioredis";

const DEFAULT_LOCAL_REDIS_URL = "redis://localhost:6379";

const globalForRedis = globalThis as unknown as { redis?: Redis };

const redisUrl = process.env.REDIS_URL ?? DEFAULT_LOCAL_REDIS_URL;

export const redis =
  globalForRedis.redis ??
  new Redis(redisUrl, {
    maxRetriesPerRequest: 2,
    lazyConnect: true,
    enableOfflineQueue: false,
    retryStrategy: (times) => {
      // Stop retrying after 3 attempts to avoid log spam
      if (times > 3) return null;
      return Math.min(times * 500, 3000);
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

// Hindari crash/logging bising saat build bila Redis belum siap/NOAUTH
redis.on("error", () => {});

interface RateLimitOptions {
  /**
   * Tenant scope untuk rate limit. Tanpa ini, key dishare lintas tenant
   * (mis. user-id 123 di tenant A dan tenant B berbagi bucket yang sama).
   * Bila tidak diketahui (request publik tanpa tenant resolved), gunakan
   * `"global"` agar tetap eksplisit.
   */
  tenantId: string | null;
  /**
   * Bila true, gagal ketika Redis tidak available (mis. login, OTP, password
   * reset). Default false (fail-open) untuk endpoint umum.
   */
  failClosed?: boolean;
}

function buildSafeKey(rawKey: string): string | null {
  if (!rawKey || typeof rawKey !== "string" || rawKey.length === 0) {
    return null;
  }
  const safeKey = String(rawKey)
    .trim()
    .replace(/[^a-zA-Z0-9:_-]/g, "_");
  return safeKey || null;
}

function buildTenantScope(tenantId: string | null): string {
  if (!tenantId) {
    return "global";
  }
  return tenantId.replace(/[^a-zA-Z0-9_-]/g, "_") || "global";
}

export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowSeconds: number,
  options: RateLimitOptions = { tenantId: null },
) {
  const safeKey = buildSafeKey(key);
  if (!safeKey) {
    return true; // Skip rate limiting jika key tidak valid
  }

  const tenantScope = buildTenantScope(options.tenantId);
  const failClosed = options.failClosed ?? false;

  const now = Date.now();
  const bucketKey = `rl:${tenantScope}:${safeKey}:${Math.floor(now / (windowSeconds * 1000))}`;

  try {
    const count = await redis.incr(bucketKey);
    if (count === 1) {
      await redis.expire(bucketKey, windowSeconds);
    }

    // Progressive delay: semakin banyak percobaan, semakin lama delay
    if (count > maxAttempts) {
      // Calculate delay based on excess attempts
      const excessAttempts = count - maxAttempts;
      const delaySeconds = Math.min(excessAttempts * 30, 300); // Max 5 menit delay

      // Set a separate key for tracking the delay
      const delayKey = `delay:${tenantScope}:${safeKey}`;
      await redis.setex(delayKey, delaySeconds, "1");

      logger.info(
        `Rate limit exceeded for ${tenantScope}:${safeKey}. Delay: ${delaySeconds}s`,
      );
      return false;
    }

    return count <= maxAttempts;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Redis rate limit error:", errorMessage);
    // Endpoint sensitif (login/OTP) WAJIB fail-closed agar Redis outage tidak
    // membuka jalan brute-force. Endpoint umum tetap fail-open.
    if (failClosed) {
      return false;
    }
    return true;
  }
}

/**
 * Check if there's an active delay for a key and return remaining time
 */
export async function checkDelay(
  key: string,
  options: { tenantId: string | null } = { tenantId: null },
): Promise<number> {
  const safeKey = buildSafeKey(key);
  if (!safeKey) {
    return 0;
  }

  const tenantScope = buildTenantScope(options.tenantId);
  const delayKey = `delay:${tenantScope}:${safeKey}`;

  try {
    const ttl = await redis.ttl(delayKey);
    return ttl > 0 ? ttl : 0;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Redis delay check error:", errorMessage);
    return 0;
  }
}
