import { redis } from '@/lib/redis'
import { logger } from '@/lib/logger'

/**
 * ONU Cache Service
 * 
 * Provides caching layer for ONU data to reduce database load
 * and improve API response times for large-scale ONU datasets.
 */

const CACHE_TTL = 300 // 5 minutes
const SEARCH_CACHE_TTL = 60 // 1 minute for search results
const CACHE_PREFIX = 'onu:'

export interface CacheStats {
    hits: number
    misses: number
    hitRate: number
    lastReset: Date
}

export class OnuCacheService {
    /**
     * Cache ONU list for a specific OLT
     */
    async cacheOltOnus(oltId: string, onus: any[]): Promise<void> {
        try {
            const key = this.getOltCacheKey(oltId)
            await redis.setex(key, CACHE_TTL, JSON.stringify(onus))

            logger.debug(`Cached ${onus.length} ONUs for OLT ${oltId}`, {
                action: 'cache_set',
                oltId,
                count: onus.length,
                ttl: CACHE_TTL,
            })
        } catch (error) {
            logger.error('Failed to cache OLT ONUs', error instanceof Error ? error : new Error(String(error)), { oltId })
            // Don't throw - cache failures should not break the application
        }
    }

    /**
     * Get cached ONU list for a specific OLT
     */
    async getCachedOltOnus(oltId: string): Promise<any[] | null> {
        try {
            const key = this.getOltCacheKey(oltId)
            const cached = await redis.get(key)

            if (cached) {
                await this.incrementHit()
                logger.debug(`Cache hit for OLT ${oltId}`, {
                    action: 'cache_hit',
                    oltId,
                })
                return JSON.parse(cached)
            }

            await this.incrementMiss()
            logger.debug(`Cache miss for OLT ${oltId}`, {
                action: 'cache_miss',
                oltId,
            })
            return null
        } catch (error) {
            logger.error('Failed to get cached OLT ONUs', error instanceof Error ? error : new Error(String(error)), { oltId })
            return null
        }
    }

    /**
     * Cache search results
     */
    async cacheSearchResults(query: string, results: any[]): Promise<void> {
        try {
            const key = this.getSearchCacheKey(query)
            await redis.setex(key, SEARCH_CACHE_TTL, JSON.stringify(results))

            logger.debug(`Cached search results for query: ${query}`, {
                action: 'cache_search',
                query,
                count: results.length,
            })
        } catch (error) {
            logger.error('Failed to cache search results', error instanceof Error ? error : new Error(String(error)), { query })
        }
    }

    /**
     * Get cached search results
     */
    async getCachedSearchResults(query: string): Promise<any[] | null> {
        try {
            const key = this.getSearchCacheKey(query)
            const cached = await redis.get(key)

            if (cached) {
                await this.incrementHit()
                return JSON.parse(cached)
            }

            await this.incrementMiss()
            return null
        } catch (error) {
            logger.error('Failed to get cached search results', error instanceof Error ? error : new Error(String(error)), { query })
            return null
        }
    }

    /**
     * Invalidate cache for a specific OLT
     */
    async invalidateOltCache(oltId: string): Promise<void> {
        try {
            const key = this.getOltCacheKey(oltId)
            await redis.del(key)

            logger.info(`Invalidated cache for OLT ${oltId}`, {
                action: 'cache_invalidate',
                oltId,
            })
        } catch (error) {
            logger.error('Failed to invalidate OLT cache', error instanceof Error ? error : new Error(String(error)), { oltId })
        }
    }

    /**
     * Invalidate all ONU caches
     */
    async invalidateAllCaches(): Promise<void> {
        try {
            const pattern = `${CACHE_PREFIX}*`
            const keys = await redis.keys(pattern)

            if (keys.length > 0) {
                await redis.del(...keys)
                logger.info(`Invalidated ${keys.length} ONU cache keys`, {
                    action: 'cache_invalidate_all',
                    count: keys.length,
                })
            }
        } catch (error) {
            logger.error('Failed to invalidate all caches', error instanceof Error ? error : new Error(String(error)))
        }
    }

    /**
     * Invalidate search caches
     */
    async invalidateSearchCaches(): Promise<void> {
        try {
            const pattern = `${CACHE_PREFIX}search:*`
            const keys = await redis.keys(pattern)

            if (keys.length > 0) {
                await redis.del(...keys)
                logger.debug(`Invalidated ${keys.length} search cache keys`, {
                    action: 'cache_invalidate_search',
                    count: keys.length,
                })
            }
        } catch (error) {
            logger.error('Failed to invalidate search caches', error instanceof Error ? error : new Error(String(error)))
        }
    }

    /**
     * Get cache statistics
     */
    async getCacheStats(): Promise<CacheStats> {
        try {
            const hitsKey = `${CACHE_PREFIX}stats:hits`
            const missesKey = `${CACHE_PREFIX}stats:misses`
            const resetKey = `${CACHE_PREFIX}stats:reset`

            const [hits, misses, lastReset] = await Promise.all([
                redis.get(hitsKey),
                redis.get(missesKey),
                redis.get(resetKey),
            ])

            const hitsCount = parseInt(hits || '0', 10)
            const missesCount = parseInt(misses || '0', 10)
            const total = hitsCount + missesCount
            const hitRate = total > 0 ? (hitsCount / total) * 100 : 0

            return {
                hits: hitsCount,
                misses: missesCount,
                hitRate: parseFloat(hitRate.toFixed(2)),
                lastReset: lastReset ? new Date(lastReset) : new Date(),
            }
        } catch (error) {
            logger.error('Failed to get cache stats', error instanceof Error ? error : new Error(String(error)))
            return {
                hits: 0,
                misses: 0,
                hitRate: 0,
                lastReset: new Date(),
            }
        }
    }

    /**
     * Reset cache statistics
     */
    async resetCacheStats(): Promise<void> {
        try {
            const hitsKey = `${CACHE_PREFIX}stats:hits`
            const missesKey = `${CACHE_PREFIX}stats:misses`
            const resetKey = `${CACHE_PREFIX}stats:reset`

            await Promise.all([
                redis.set(hitsKey, '0'),
                redis.set(missesKey, '0'),
                redis.set(resetKey, new Date().toISOString()),
            ])

            logger.info('Cache statistics reset', { action: 'cache_stats_reset' })
        } catch (error) {
            logger.error('Failed to reset cache stats', error instanceof Error ? error : new Error(String(error)))
        }
    }

    /**
     * Get cache key for OLT
     */
    private getOltCacheKey(oltId: string): string {
        return `${CACHE_PREFIX}olt:${oltId}`
    }

    /**
     * Get cache key for search
     */
    private getSearchCacheKey(query: string): string {
        // Normalize query for consistent caching
        const normalized = query.toLowerCase().trim()
        return `${CACHE_PREFIX}search:${normalized}`
    }

    /**
     * Increment cache hit counter
     */
    private async incrementHit(): Promise<void> {
        try {
            const key = `${CACHE_PREFIX}stats:hits`
            await redis.incr(key)
        } catch (error) {
            // Silently fail - stats are not critical
        }
    }

    /**
     * Increment cache miss counter
     */
    private async incrementMiss(): Promise<void> {
        try {
            const key = `${CACHE_PREFIX}stats:misses`
            await redis.incr(key)
        } catch (error) {
            // Silently fail - stats are not critical
        }
    }
}

// Export singleton instance
export const onuCacheService = new OnuCacheService()
