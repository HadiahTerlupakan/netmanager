import { redis } from '@/lib/redis'
import type { Redis } from 'ioredis'

/**
 * Iterate all keys matching a pattern using SCAN cursor to avoid blocking Redis.
 */
async function scanKeys(client: Redis, pattern: string): Promise<string[]> {
    const keys: string[] = []
    let cursor = '0'
    do {
        const [nextCursor, batch] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
        cursor = nextCursor
        keys.push(...batch)
    } while (cursor !== '0')
    return keys
}
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

const CACHE_PREFIX = 'workorder:'
const DASHBOARD_TTL = 60      // 1 minute for dashboard data
const STATS_TTL = 120         // 2 minutes for statistics
const LIST_TTL = 30           // 30 seconds for list data

export interface WorkOrderCacheStats {
    hits: number;
    misses: number;
    hitRate: number;
    lastReset: Date;
}

export class WorkOrderCacheService {
    /**
     * Cache dashboard data
     */
    async cacheDashboardData(
        userId: string,
        period: string,
        data: unknown,
        options?: { departmentId?: string; siteId?: string }
    ): Promise<void> {
        try {
            const key = this.getDashboardCacheKey(userId, period, options);
            await redis.setex(key, DASHBOARD_TTL, JSON.stringify(data));
            // console.log(`[CACHE] Cached dashboard data for user ${userId}, period ${period}`);
        } catch (error) {
            console.error('[CACHE] Failed to cache dashboard data:', error);
            // Don't throw - cache failures should not break the application
        }
    }

    /**
     * Get cached dashboard data
     */
    async getCachedDashboardData(
        userId: string,
        period: string,
        options?: { departmentId?: string; siteId?: string }
    ): Promise<unknown | null> {
        try {
            const key = this.getDashboardCacheKey(userId, period, options);
            const cached = await redis.get(key);

            if (cached) {
                await this.incrementHit();
                // console.log(`[CACHE] Hit: dashboard data for user ${userId}`);
                return JSON.parse(cached);
            }

            await this.incrementMiss();
            // console.log(`[CACHE] Miss: dashboard data for user ${userId}`);
            return null;
        } catch (error) {
            console.error('[CACHE] Failed to get cached dashboard data:', error);
            return null;
        }
    }

    /**
     * Cache work order statistics
     */
    async cacheStatistics(
        filters: { departmentId?: string; siteId?: string },
        stats: unknown
    ): Promise<void> {
        try {
            const key = this.getStatsCacheKey(filters);
            await redis.setex(key, STATS_TTL, JSON.stringify(stats));
        } catch (error) {
            console.error('[CACHE] Failed to cache statistics:', error);
        }
    }

    /**
     * Get cached statistics
     */
    async getCachedStatistics(
        filters: { departmentId?: string; siteId?: string }
    ): Promise<unknown | null> {
        try {
            const key = this.getStatsCacheKey(filters);
            const cached = await redis.get(key);

            if (cached) {
                await this.incrementHit();
                return JSON.parse(cached);
            }

            await this.incrementMiss();
            return null;
        } catch (error) {
            console.error('[CACHE] Failed to get cached statistics:', error);
            return null;
        }
    }

    /**
     * Cache work order list
     */
    async cacheWorkOrderList(
        cacheKey: string,
        data: unknown
    ): Promise<void> {
        try {
            const key = `${CACHE_PREFIX}list:${cacheKey}`;
            await redis.setex(key, LIST_TTL, JSON.stringify(data));
        } catch (error) {
            console.error('[CACHE] Failed to cache work order list:', error);
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
            console.error('[CACHE] Failed to get cached work order list:', error);
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
                // console.log(`[CACHE] Invalidated ${keys.length} work order cache keys`);
            }
        } catch (error) {
            console.error('[CACHE] Failed to invalidate all caches:', error);
        }
    }

    /**
     * Invalidate dashboard caches only
     */
    async invalidateDashboardCaches(): Promise<void> {
        try {
            const pattern = `${CACHE_PREFIX}dashboard:*`;
            const keys = await scanKeys(redis, pattern);

            if (keys.length > 0) {
                await redis.del(...keys);
                // console.log(`[CACHE] Invalidated ${keys.length} dashboard cache keys`);
            }
        } catch (error) {
            console.error('[CACHE] Failed to invalidate dashboard caches:', error);
        }
    }

    /**
     * Invalidate list caches only
     */
    async invalidateListCaches(): Promise<void> {
        try {
            const pattern = `${CACHE_PREFIX}list:*`;
            const keys = await scanKeys(redis, pattern);

            if (keys.length > 0) {
                await redis.del(...keys);
                // console.log(`[CACHE] Invalidated ${keys.length} list cache keys`);
            }
        } catch (error) {
            console.error('[CACHE] Failed to invalidate list caches:', error);
        }
    }

    /**
     * Invalidate stats caches only
     */
    async invalidateStatsCaches(): Promise<void> {
        try {
            const pattern = `${CACHE_PREFIX}stats:*`;
            const keys = await scanKeys(redis, pattern);

            if (keys.length > 0) {
                await redis.del(...keys);
                // console.log(`[CACHE] Invalidated ${keys.length} stats cache keys`);
            }
        } catch (error) {
            console.error('[CACHE] Failed to invalidate stats caches:', error);
        }
    }

    /**
     * Get cache statistics
     */
    async getCacheStats(): Promise<WorkOrderCacheStats> {
        try {
            const hitsKey = `${CACHE_PREFIX}metrics:hits`;
            const missesKey = `${CACHE_PREFIX}metrics:misses`;
            const resetKey = `${CACHE_PREFIX}metrics:reset`;

            const [hits, misses, lastReset] = await Promise.all([
                redis.get(hitsKey),
                redis.get(missesKey),
                redis.get(resetKey),
            ]);

            const hitsCount = parseInt(hits || '0', 10);
            const missesCount = parseInt(misses || '0', 10);
            const total = hitsCount + missesCount;
            const hitRate = total > 0 ? (hitsCount / total) * 100 : 0;

            return {
                hits: hitsCount,
                misses: missesCount,
                hitRate: parseFloat(hitRate.toFixed(2)),
                lastReset: lastReset ? new Date(lastReset) : new Date(),
            };
        } catch (error) {
            console.error('[CACHE] Failed to get cache stats:', error);
            return {
                hits: 0,
                misses: 0,
                hitRate: 0,
                lastReset: new Date(),
            };
        }
    }

    /**
     * Build dashboard cache key
     */
    private getDashboardCacheKey(
        userId: string,
        period: string,
        options?: { departmentId?: string; siteId?: string }
    ): string {
        const parts = [CACHE_PREFIX, 'dashboard', userId, period];
        if (options?.departmentId) parts.push(`dept:${options.departmentId}`);
        if (options?.siteId) parts.push(`site:${options.siteId}`);
        return parts.join(':');
    }

    /**
     * Build stats cache key
     */
    private getStatsCacheKey(filters: { departmentId?: string; siteId?: string }): string {
        const parts = [CACHE_PREFIX, 'stats'];
        if (filters.departmentId) parts.push(`dept:${filters.departmentId}`);
        if (filters.siteId) parts.push(`site:${filters.siteId}`);
        return parts.join(':') || `${CACHE_PREFIX}stats:global`;
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
