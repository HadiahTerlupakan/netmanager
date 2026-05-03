import { LRUCache } from "@/lib/utils/lru-cache";
import {
  CACHE_CLEANUP_INTERVAL_MS,
  CACHE_TTL_MS,
} from "@/modules/network/services/snmp-optimized.constants";

const DEFAULT_CACHE_MAX_ENTRIES = 100;

export type CacheValue = { data: Record<string, string> };

/** SNMP cache service: LRU cache dengan auto-cleanup interval. */
export class SnmpCacheService {
  private readonly cache: LRUCache<string, CacheValue>;
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.cache = new LRUCache<string, CacheValue>(
      DEFAULT_CACHE_MAX_ENTRIES,
      CACHE_TTL_MS,
    );
    this.cleanupInterval = setInterval(() => {
      this.cache.cleanup();
    }, CACHE_CLEANUP_INTERVAL_MS);
  }

  getCacheKey(ipAddress: string, oid: string): string {
    return `${ipAddress}:${oid}`;
  }

  get(key: string): Record<string, string> | null {
    return this.cache.get(key)?.data ?? null;
  }

  set(key: string, data: Record<string, string>): void {
    this.cache.set(key, { data });
  }

  clear(): void {
    this.cache.clear();
  }

  cleanup(): void {
    this.cache.cleanup();
  }

  stopCleanup(): void {
    clearInterval(this.cleanupInterval);
  }
}
