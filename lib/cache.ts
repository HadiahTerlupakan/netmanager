/**
 * Simple in-memory cache implementation for performance optimization
 * Supports TTL-based expiration and pattern-based invalidation
 */

interface CacheEntry<T> {
  data: T
  expiry: number
}

export class SimpleCache {
  private cache = new Map<string, CacheEntry<unknown>>()
  
  /**
   * Store data in cache with TTL (time-to-live) in seconds
   */
  set<T>(key: string, data: T, ttlSeconds: number): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlSeconds * 1000
    })
  }
  
  /**
   * Retrieve data from cache if it exists and hasn't expired
   * Returns null if not found or expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    
    // Check if expired
    if (Date.now() > entry.expiry) {
      this.cache.delete(key)
      return null
    }
    
    return entry.data as T
  }
  
  /**
   * Invalidate cache entries matching a pattern
   * Uses simple string matching (key.includes(pattern))
   */
  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    }
  }
  
  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
  }
  
  /**
   * Get cache statistics
   */
  getStats(): { size: number } {
    return {
      size: this.cache.size
    }
  }
}

// Export singleton instance for application-wide use
export const cache = new SimpleCache()
