/**
 * Simple in-memory cache implementation for performance optimization
 * Supports TTL-based expiration and pattern-based invalidation
 * Includes automatic cleanup of expired entries
 */

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

export class SimpleCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Store data in cache with TTL (time-to-live) in seconds
   */
  set<T>(key: string, data: T, ttlSeconds: number): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Retrieve data from cache if it exists and hasn't expired
   * Returns null if not found or expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Invalidate cache entries matching a pattern
   * Uses simple string matching (key.includes(pattern))
   */
  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; expiredCount: number } {
    const now = Date.now();
    let expiredCount = 0;

    for (const entry of this.cache.values()) {
      if (now > entry.expiry) {
        expiredCount++;
      }
    }

    return {
      size: this.cache.size,
      expiredCount,
    };
  }

  /**
   * Start automatic cleanup of expired entries
   * @param intervalMs - Cleanup interval in milliseconds (default: 60 seconds)
   */
  startCleanup(intervalMs: number = 60000): void {
    if (this.cleanupInterval) {
      this.stopCleanup();
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, intervalMs);

    // Don't prevent the process from exiting
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Stop automatic cleanup
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Manually cleanup expired entries
   * @returns Number of entries removed
   */
  cleanupExpired(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }
}

// Export singleton instance for application-wide use
export const cache = new SimpleCache();

// Start automatic cleanup in production
if (process.env.NODE_ENV === "production") {
  cache.startCleanup(60000); // Cleanup every 60 seconds
}
