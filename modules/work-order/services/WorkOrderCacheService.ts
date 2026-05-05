import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import {
  getDashboardCacheKey,
  getStatsCacheKey,
  invalidateCacheGroup,
  readCacheStats,
  scanKeys,
  type CacheStats as WorkOrderCacheStats,
} from "./work-order-cache.helpers";
/**
 * Work Order Cache Service
 *
 * Provides caching layer for Work Order dashboard and statistics data
 * to reduce database load and improve API response times.
 *
 * Cache Strategy:
 * - Dashboard stats: 60 seconds TTL (frequently updated)
 * - List view data: 30 seconds TTL (real-time important)
 * - Statistics: 120 seconds TTL (less critical)
 *
 * Invalidation:
 * - On work order create/update/delete
 * - On status change
 * - On assignment change
 */

const CACHE_PREFIX = "workorder:";
const DASHBOARD_TTL = 60; // 1 minute for dashboard data
const STATS_TTL = 120; // 2 minutes for statistics
const LIST_TTL = 30; // 30 seconds for list data

export type { WorkOrderCacheStats };

export class WorkOrderCacheService {
  /**
   * Cache dashboard data
   */
  async cacheDashboardData(
    userId: string,
    period: string,
    data: unknown,
    options?: { departmentId?: string; siteId?: string },
  ): Promise<void> {
    try {
      const key = getDashboardCacheKey(CACHE_PREFIX, userId, period, options);
      await redis.setex(key, DASHBOARD_TTL, JSON.stringify(data));
      // logger.info(`[CACHE] Cached dashboard data for user ${userId}, period ${period}`);
    } catch (error) {
      logger.error("[CACHE] Failed to cache dashboard data:", error);
      // Don't throw - cache failures should not break the application
    }
  }

  /**
   * Get cached dashboard data
   */
  async getCachedDashboardData(
    userId: string,
    period: string,
    options?: { departmentId?: string; siteId?: string },
  ): Promise<unknown | null> {
    try {
      const key = getDashboardCacheKey(CACHE_PREFIX, userId, period, options);
      const cached = await redis.get(key);

      if (cached) {
        await this.incrementHit();
        // logger.info(`[CACHE] Hit: dashboard data for user ${userId}`);
        return JSON.parse(cached);
      }

      await this.incrementMiss();
      // logger.info(`[CACHE] Miss: dashboard data for user ${userId}`);
      return null;
    } catch (error) {
      logger.error("[CACHE] Failed to get cached dashboard data:", error);
      return null;
    }
  }

  /**
   * Cache work order statistics
   */
  async cacheStatistics(
    filters: { departmentId?: string; siteId?: string },
    stats: unknown,
  ): Promise<void> {
    try {
      const key = getStatsCacheKey(CACHE_PREFIX, filters);
      await redis.setex(key, STATS_TTL, JSON.stringify(stats));
    } catch (error) {
      logger.error("[CACHE] Failed to cache statistics:", error);
    }
  }

  /**
   * Get cached statistics
   */
  async getCachedStatistics(filters: {
    departmentId?: string;
    siteId?: string;
  }): Promise<unknown | null> {
    try {
      const key = getStatsCacheKey(CACHE_PREFIX, filters);
      const cached = await redis.get(key);

      if (cached) {
        await this.incrementHit();
        return JSON.parse(cached);
      }

      await this.incrementMiss();
      return null;
    } catch (error) {
      logger.error("[CACHE] Failed to get cached statistics:", error);
      return null;
    }
  }

  /**
   * Cache work order list
   */
  async cacheWorkOrderList(cacheKey: string, data: unknown): Promise<void> {
    try {
      const key = `${CACHE_PREFIX}list:${cacheKey}`;
      await redis.setex(key, LIST_TTL, JSON.stringify(data));
    } catch (error) {
      logger.error("[CACHE] Failed to cache work order list:", error);
    }
  }

  /**
   * Get cached work order list
   */
  async getCachedWorkOrderList(cacheKey: string): Promise<unknown | null> {
    try {
      const key = `${CACHE_PREFIX}list:${cacheKey}`;
      const cached = await redis.get(key);

      if (cached) {
        await this.incrementHit();
        return JSON.parse(cached);
      }

      await this.incrementMiss();
      return null;
    } catch (error) {
      logger.error("[CACHE] Failed to get cached work order list:", error);
      return null;
    }
  }

  /**
   * Invalidate all work order caches
   * Call this on work order create/update/delete
   */
  async invalidateAllCaches(): Promise<void> {
    try {
      const pattern = `${CACHE_PREFIX}*`;
      const keys = await scanKeys(redis, pattern);

      if (keys.length > 0) {
        await redis.del(...keys);
        // logger.info(`[CACHE] Invalidated ${keys.length} work order cache keys`);
      }
    } catch (error) {
      logger.error("[CACHE] Failed to invalidate all caches:", error);
    }
  }

  /**
   * Invalidate dashboard caches only
   */
  async invalidateDashboardCaches(): Promise<void> {
    try {
      await invalidateCacheGroup(CACHE_PREFIX, "dashboard:*");
    } catch (error) {
      logger.error("[CACHE] Failed to invalidate dashboard caches:", error);
    }
  }

  /**
   * Invalidate list caches only
   */
  async invalidateListCaches(): Promise<void> {
    try {
      await invalidateCacheGroup(CACHE_PREFIX, "list:*");
    } catch (error) {
      logger.error("[CACHE] Failed to invalidate list caches:", error);
    }
  }

  /**
   * Invalidate stats caches only
   */
  async invalidateStatsCaches(): Promise<void> {
    try {
      await invalidateCacheGroup(CACHE_PREFIX, "stats:*");
    } catch (error) {
      logger.error("[CACHE] Failed to invalidate stats caches:", error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<WorkOrderCacheStats> {
    return readCacheStats(CACHE_PREFIX);
  }

  /**
   * Increment cache hit counter
   */
  private async incrementHit(): Promise<void> {
    try {
      const key = `${CACHE_PREFIX}metrics:hits`;
      await redis.incr(key);
    } catch (_error) {
      // Silently fail - stats are not critical
    }
  }

  /**
   * Increment cache miss counter
   */
  private async incrementMiss(): Promise<void> {
    try {
      const key = `${CACHE_PREFIX}metrics:misses`;
      await redis.incr(key);
    } catch (_error) {
      // Silently fail - stats are not critical
    }
  }
}

// Export singleton instance
export const workOrderCacheService = new WorkOrderCacheService();
