/**
 * Optimized SNMP utilities untuk handling large ONU data.
 *
 * Facade yang mendelegasikan ke extracted services:
 * - SnmpCacheService (cache management)
 * - SNMPConnectionPoolService (connection pooling)
 * - snmp-walk-executor (GETBULK + subtree walk)
 * - snmp-dataset-fetch (status + ONU dataset orchestration)
 * - snmp-pagination (pagination + item building)
 */

import { shutdownManager } from "@/lib/shutdown-manager";
import { buildOnuItem } from "./snmp-optimized.helpers";
import { SnmpCacheService } from "./snmp-cache.service";
import { SNMPConnectionPoolService } from "./snmp-connection-pool.service";
import { snmpWalkOptimized as snmpWalkOptimizedInternal } from "./snmp-walk-executor.service";
import {
  fetchOnuDatasets,
  fetchStatusDataset,
} from "./snmp-dataset-fetch.service";
import {
  buildEmptyPagination,
  buildPagination,
  buildPaginatedOnuItems,
  getPagedIndexes,
} from "./snmp-pagination.service";

const cache = new SnmpCacheService();
const connectionPool = new SNMPConnectionPoolService();

/** Optimized SNMP fetch menggunakan GETBULK lalu fallback subtree walk. */
export async function snmpWalkOptimized(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oid: string,
  options: {
    timeout?: number;
    useCache?: boolean;
    chunkSize?: number;
  } = {},
): Promise<Record<string, string>> {
  return snmpWalkOptimizedInternal(
    ipAddress,
    port,
    community,
    version,
    oid,
    connectionPool,
    { ...options, cacheService: cache },
  );
}

/** Ambil data ONU terpaginasikan dengan cache status dan dataset pendukung. */
export async function fetchOnuDataPaginated(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oltId: string,
  page: number = 1,
  pageSize: number = 100,
): Promise<{
  data: Array<ReturnType<typeof buildOnuItem>>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}> {
  const statusCacheKey = cache.getCacheKey(
    ipAddress,
    "1.3.6.1.4.1.3902.1012.3.28.2.1.4",
  );
  let statusData = cache.get(statusCacheKey);

  if (!statusData) {
    statusData = await fetchStatusDataset(
      ipAddress,
      port,
      community,
      version,
      connectionPool,
      cache,
    );
    if (Object.keys(statusData).length > 0) {
      cache.set(statusCacheKey, statusData);
    }
  }

  const totalOnus = Object.keys(statusData).length;
  if (totalOnus === 0) {
    return { data: [], pagination: buildEmptyPagination(pageSize) };
  }

  const indexes = getPagedIndexes(statusData, page, pageSize);
  const datasets = await fetchOnuDatasets(
    ipAddress,
    port,
    community,
    version,
    totalOnus,
    statusData,
    connectionPool,
    cache,
  );

  return {
    data: buildPaginatedOnuItems(indexes, oltId, datasets, buildOnuItem),
    pagination: buildPagination(page, pageSize, totalOnus),
  };
}

/** Bersihkan cache SNMP in-memory. */
export function clearSNMPCache(): void {
  cache.clear();
}

/** Bersihkan pool koneksi SNMP dan cache. */
export function cleanupSNMPConnections(): void {
  connectionPool.cleanup();
  cache.clear();
}

// Register cleanup on graceful shutdown
if (typeof process !== "undefined") {
  shutdownManager.register(() => {
    cleanupSNMPConnections();
  });
  process.on("beforeExit", cleanupSNMPConnections);
}
