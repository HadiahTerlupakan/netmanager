import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import type { Redis } from "ioredis";

const SCAN_COUNT = 100;

type CacheStats = {
  hits: number;
  misses: number;
  hitRate: number;
  lastReset: Date;
};

export type { CacheStats };

export async function scanKeys(
  client: Redis,
  pattern: string,
): Promise<string[]> {
  const keys: string[] = [];
  let cursor = "0";

  do {
    const [nextCursor, batch] = await client.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      SCAN_COUNT,
    );
    cursor = nextCursor;
    keys.push(...batch);
  } while (cursor !== "0");

  return keys;
}

export async function invalidateCacheGroup(prefix: string, suffix: string) {
  try {
    const keys = await scanKeys(redis, `${prefix}${suffix}`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    logger.error(`[CACHE] Failed to invalidate ${suffix} caches:`, error);
  }
}

export async function readCacheStats(prefix: string): Promise<CacheStats> {
  try {
    const metrics = await readCacheMetricValues(prefix);
    return buildCacheStats(metrics);
  } catch (error) {
    logger.error("[CACHE] Failed to get cache stats:", error);
    return createEmptyCacheStats();
  }
}

async function readCacheMetricValues(prefix: string) {
  const [hits, misses, lastReset] = await Promise.all([
    redis.get(`${prefix}metrics:hits`),
    redis.get(`${prefix}metrics:misses`),
    redis.get(`${prefix}metrics:reset`),
  ]);

  return { hits, misses, lastReset };
}

function buildCacheStats(metrics: {
  hits: string | null;
  misses: string | null;
  lastReset: string | null;
}): CacheStats {
  const hits = parseCacheMetric(metrics.hits);
  const misses = parseCacheMetric(metrics.misses);

  return {
    hits,
    misses,
    hitRate: calculateHitRate(hits, misses),
    lastReset: metrics.lastReset ? new Date(metrics.lastReset) : new Date(),
  };
}

function parseCacheMetric(value: string | null) {
  return parseInt(value || "0", 10);
}

function calculateHitRate(hits: number, misses: number) {
  const total = hits + misses;
  const hitRate = total > 0 ? (hits / total) * 100 : 0;
  return parseFloat(hitRate.toFixed(2));
}

function createEmptyCacheStats(): CacheStats {
  return {
    hits: 0,
    misses: 0,
    hitRate: 0,
    lastReset: new Date(),
  };
}

export function getDashboardCacheKey(
  prefix: string,
  userId: string,
  period: string,
  options?: { departmentId?: string; siteId?: string },
): string {
  const parts = [prefix, "dashboard", userId, period];
  if (options?.departmentId) parts.push(`dept:${options.departmentId}`);
  if (options?.siteId) parts.push(`site:${options.siteId}`);
  return parts.join(":");
}

export function getStatsCacheKey(
  prefix: string,
  filters: { departmentId?: string; siteId?: string },
): string {
  const parts = [prefix, "stats"];
  if (filters.departmentId) parts.push(`dept:${filters.departmentId}`);
  if (filters.siteId) parts.push(`site:${filters.siteId}`);
  return parts.join(":") || `${prefix}stats:global`;
}
