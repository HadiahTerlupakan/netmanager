/**
 * LRU Cache with TTL and size limits
 * Used for SNMP data caching to prevent unbounded memory growth
 */

interface CacheEntry<V> {
  value: V
  timestamp: number
}

export class LRUCache<K, V> {
  private cache: Map<K, CacheEntry<V>>
  private readonly maxSize: number
  private readonly maxAge: number // in milliseconds

  constructor(maxSize: number = 100, maxAgeMs: number = 300000) {
    this.cache = new Map()
    this.maxSize = maxSize
    this.maxAge = maxAgeMs
  }

  /**
   * Set a value in the cache
   * Removes oldest entry if cache is at capacity
   */
  set(key: K, value: V): void {
    // Remove if exists (to update position)
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }

    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey)
      }
    }

    // Add new entry at end (most recently used)
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    })
  }

  /**
   * Get a value from cache
   * Returns undefined if not found or expired
   * Moves accessed item to end (most recently used)
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return undefined
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key)
      return undefined
    }

    // Move to end (most recently used)
    this.cache.delete(key)
    this.cache.set(key, entry)
    
    return entry.value
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: K): boolean {
    return this.get(key) !== undefined
  }

  /**
   * Delete a specific key
   */
  delete(key: K): boolean {
    return this.cache.delete(key)
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get current size
   */
  get size(): number {
    return this.cache.size
  }

  /**
   * Cleanup expired entries
   * Returns number of entries removed
   */
  cleanup(): number {
    const now = Date.now()
    let removed = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.maxAge) {
        this.cache.delete(key)
        removed++
      }
    }

    return removed
  }

  /**
   * Get cache stats for monitoring
   */
  getStats(): { size: number; maxSize: number; maxAgeMs: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      maxAgeMs: this.maxAge
    }
  }
}
