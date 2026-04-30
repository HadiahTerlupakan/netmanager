/**
 * Optimized SNMP utilities untuk handling large ONU data.
 */

import snmp from "net-snmp";
import { LRUCache } from "@/lib/utils/lru-cache";
import { snmpGetBulkSimple } from "./snmpService";
import {
  CACHE_CLEANUP_INTERVAL_MS,
  CACHE_TTL_MS,
  MAX_CHUNK_SIZE,
  MAX_CONCURRENT_SESSIONS,
  POST_TIMEOUT_GRACE_MS,
  SESSION_REUSE_WINDOW_MS,
  SESSION_WAIT_MS,
  SNMP_TIMEOUT_MS,
  SUBTREE_MAX_REPETITIONS,
} from "./snmp-optimized.constants";
import {
  buildOnuItem,
  resolveOnuDataTimeout,
  type OnuDatasetCollection,
} from "./snmp-optimized.helpers";

const DEFAULT_CACHE_MAX_ENTRIES = 100;
const STATUS_BASE_OID = "1.3.6.1.4.1.3902.1012.3.28.1.1";
const STATUS_NEW_OID = "1.3.6.1.4.1.3902.1012.3.28.2.1.4";
const STATUS_OLD_OID = `${STATUS_BASE_OID}.6`;
const ONU_NAME_OID = `${STATUS_BASE_OID}.2`;
const ONU_SERIAL_OID = `${STATUS_BASE_OID}.5`;
const ONU_DESC_OID = "1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.3";
const ONU_RX_OLT_OID = "1.3.6.1.4.1.3902.1015.1010.11.2.1.2";
const ONU_RX_ONU_OID = "1.3.6.1.4.1.3902.1012.3.50.12.1.1.10";
const ONU_ACTUAL_TYPE_OID = "1.3.6.1.4.1.3902.1012.3.50.11.2.1.9";
const ONU_PPPOE_OID = "1.3.6.1.4.1.3902.1082.500.20.2.17.2.1.11";

type CacheValue = { data: Record<string, string> };
type OnuPaginationResult = {
  data: Array<ReturnType<typeof buildOnuItem>>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

type SnmpSessionEntry = {
  session: snmp.Session;
  inUse: boolean;
  lastUsed: number;
};

const cache = new LRUCache<string, CacheValue>(
  DEFAULT_CACHE_MAX_ENTRIES,
  CACHE_TTL_MS,
);

setInterval(() => {
  cache.cleanup();
}, CACHE_CLEANUP_INTERVAL_MS);

function getCacheKey(ipAddress: string, oid: string): string {
  return `${ipAddress}:${oid}`;
}

function getFromCache(key: string): Record<string, string> | null {
  return cache.get(key)?.data ?? null;
}

function setCache(key: string, data: Record<string, string>): void {
  cache.set(key, { data });
}

function normalizeSnmpError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function hasSnmpResults(record: Record<string, string>): boolean {
  return Object.keys(record).length > 0;
}

function getSnmpVersion(version: string): 0 | 1 | undefined {
  return version === "1" ? 0 : 1;
}

function createConnectionKey(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
): string {
  return `${ipAddress}:${port}:${community}:${version}`;
}

function createSnmpSession(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
): snmp.Session {
  return snmp.createSession(ipAddress, community, {
    port,
    version: getSnmpVersion(version),
    retries: 2,
    timeout: SNMP_TIMEOUT_MS,
  });
}

function closePoolSession(session: snmp.Session): void {
  try {
    session.close();
  } catch {
    return;
  }
}

function stringifyVarbindValue(value: unknown): string {
  if (Buffer.isBuffer(value)) {
    return Array.from(value as Uint8Array)
      .map((byte) => byte.toString(16).toUpperCase().padStart(2, "0"))
      .join(" ");
  }

  return String(value);
}

function normalizeWalkCallback(
  error: Error | null,
  varbinds: snmp.Varbind[],
): { error: Error | null; varbinds: snmp.Varbind[] } {
  if (
    error &&
    Array.isArray(error) &&
    error.length > 0 &&
    (error[0] as unknown as { oid: string })?.oid
  ) {
    return {
      error: null,
      varbinds: error as unknown as snmp.Varbind[],
    };
  }

  return { error, varbinds };
}

function buildEmptyPagination(pageSize: number) {
  return {
    page: 1,
    pageSize,
    total: 0,
    totalPages: 0,
  };
}

function buildPagination(page: number, pageSize: number, total: number) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}

function getPagedIndexes(
  statusData: Record<string, string>,
  page: number,
  pageSize: number,
): string[] {
  const indexes = Object.keys(statusData);
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, indexes.length);
  return indexes.slice(startIndex, endIndex);
}

class SNMPConnectionPool {
  private sessions = new Map<string, SnmpSessionEntry[]>();

  /** Ambil session SNMP reusable atau buat baru. */
  async getSession(
    ipAddress: string,
    port: number,
    community: string,
    version: string,
  ): Promise<snmp.Session> {
    const key = createConnectionKey(ipAddress, port, community, version);
    const sessionList = this.sessions.get(key) ?? [];
    this.sessions.set(key, sessionList);

    const reusable = sessionList.find(
      (entry) =>
        !entry.inUse && Date.now() - entry.lastUsed < SESSION_REUSE_WINDOW_MS,
    );
    if (reusable) {
      reusable.inUse = true;
      reusable.lastUsed = Date.now();
      return reusable.session;
    }

    if (sessionList.length < MAX_CONCURRENT_SESSIONS) {
      const created: SnmpSessionEntry = {
        session: createSnmpSession(ipAddress, port, community, version),
        inUse: true,
        lastUsed: Date.now(),
      };
      sessionList.push(created);
      return created.session;
    }

    await new Promise((resolve) => setTimeout(resolve, SESSION_WAIT_MS));
    return this.getSession(ipAddress, port, community, version);
  }

  /** Lepaskan session SNMP ke pool. */
  releaseSession(session: snmp.Session): void {
    for (const sessionList of this.sessions.values()) {
      const found = sessionList.find((entry) => entry.session === session);
      if (found) {
        found.inUse = false;
        break;
      }
    }
  }

  /** Tutup semua session SNMP di pool. */
  cleanup(): void {
    for (const sessionList of this.sessions.values()) {
      for (const entry of sessionList) {
        closePoolSession(entry.session);
      }
    }
    this.sessions.clear();
  }
}

const connectionPool = new SNMPConnectionPool();

async function fetchSnmpDataset(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oid: string,
  timeout: number,
): Promise<Record<string, string>> {
  return snmpWalkOptimized(ipAddress, port, community, version, oid, {
    useCache: true,
    timeout,
  }).catch(() => ({}));
}

async function fetchStatusDataset(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
): Promise<Record<string, string>> {
  const newStatusData = await snmpWalkOptimized(
    ipAddress,
    port,
    community,
    version,
    STATUS_NEW_OID,
    { useCache: false, timeout: SNMP_TIMEOUT_MS },
  ).catch(() => ({}));

  if (hasSnmpResults(newStatusData)) {
    return newStatusData;
  }

  return snmpWalkOptimized(
    ipAddress,
    port,
    community,
    version,
    STATUS_OLD_OID,
    {
      useCache: false,
      timeout: SNMP_TIMEOUT_MS,
      chunkSize: MAX_CHUNK_SIZE,
    },
  ).catch(() => ({}));
}

async function fetchOnuDatasets(params: {
  ipAddress: string;
  port: number;
  community: string;
  version: string;
  timeout: number;
  statusData: Record<string, string>;
}): Promise<OnuDatasetCollection> {
  const { ipAddress, port, community, version, timeout, statusData } = params;
  const [
    nameData,
    descData,
    rxOltData,
    rxOnuData,
    snData,
    actualTypeData,
    pppoeData,
  ] = await Promise.all([
    fetchSnmpDataset(
      ipAddress,
      port,
      community,
      version,
      ONU_NAME_OID,
      timeout,
    ),
    fetchSnmpDataset(
      ipAddress,
      port,
      community,
      version,
      ONU_DESC_OID,
      timeout,
    ),
    fetchSnmpDataset(
      ipAddress,
      port,
      community,
      version,
      ONU_RX_OLT_OID,
      timeout,
    ),
    fetchSnmpDataset(
      ipAddress,
      port,
      community,
      version,
      ONU_RX_ONU_OID,
      timeout,
    ),
    fetchSnmpDataset(
      ipAddress,
      port,
      community,
      version,
      ONU_SERIAL_OID,
      timeout,
    ),
    fetchSnmpDataset(
      ipAddress,
      port,
      community,
      version,
      ONU_ACTUAL_TYPE_OID,
      timeout,
    ),
    fetchSnmpDataset(
      ipAddress,
      port,
      community,
      version,
      ONU_PPPOE_OID,
      timeout,
    ),
  ]);

  return {
    statusData,
    nameData,
    descData,
    rxOltData,
    rxOnuData,
    snData,
    actualTypeData,
    pppoeData,
  };
}

function buildPaginatedOnuItems(params: {
  indexes: string[];
  oltId: string;
  datasets: OnuDatasetCollection;
}) {
  return params.indexes.map((index) =>
    buildOnuItem({ index, oltId: params.oltId, datasets: params.datasets }),
  );
}

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
  const {
    timeout = SNMP_TIMEOUT_MS,
    useCache = true,
    chunkSize = MAX_CHUNK_SIZE,
  } = options;
  const cacheKey = getCacheKey(ipAddress, oid);

  if (useCache) {
    const cached = getFromCache(cacheKey);
    if (cached) {
      return cached;
    }
  }

  try {
    const results = await snmpGetBulkSimple(
      ipAddress,
      port,
      community,
      version,
      oid,
      timeout,
    );

    if (useCache && hasSnmpResults(results)) {
      setCache(cacheKey, results);
    }

    return results;
  } catch (error) {
    console.error(
      `[SNMP-Optimized] GETBULK failed for ${oid}:`,
      normalizeSnmpError(error),
    );

    const session = await connectionPool.getSession(
      ipAddress,
      port,
      community,
      version,
    );

    try {
      const results = await snmpWalkWithChunking(
        session,
        oid,
        chunkSize,
        timeout,
      );
      if (useCache && hasSnmpResults(results)) {
        setCache(cacheKey, results);
      }
      return results;
    } finally {
      connectionPool.releaseSession(session);
    }
  }
}

/** SNMP subtree walk dengan chunking untuk dataset besar. */
async function snmpWalkWithChunking(
  session: snmp.Session,
  oid: string,
  chunkSize: number,
  timeout: number,
): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    let isResolved = false;
    const results: Record<string, string> = {};
    let currentChunk: Record<string, string> = {};

    const finish = (error?: Error) => {
      if (isResolved) return;
      isResolved = true;
      clearTimeout(timeoutId);
      flushCurrentChunk();

      if (error && !hasSnmpResults(results)) {
        reject(error);
        return;
      }

      resolve(results);
    };

    const flushCurrentChunk = () => {
      if (Object.keys(currentChunk).length >= chunkSize) {
        Object.assign(results, currentChunk);
        currentChunk = {};
        return;
      }

      if (!isResolved && Object.keys(currentChunk).length === 0) {
        return;
      }

      Object.assign(results, currentChunk);
      currentChunk = {};
    };

    const timeoutId = setTimeout(() => {
      finish();
    }, timeout);

    const processVarbinds = (error: Error | null, varbinds: snmp.Varbind[]) => {
      if (isResolved) return;

      const normalized = normalizeWalkCallback(error, varbinds);
      if (normalized.error) {
        console.warn(
          `[SNMP-Optimized] SNMP walk error: ${normalized.error.message}`,
        );
        if (hasSnmpResults(results)) {
          finish();
          return;
        }
      }

      if (!normalized.varbinds?.length) {
        finish();
        return;
      }

      for (const varbind of normalized.varbinds) {
        if (snmp.isVarbindError(varbind)) {
          if (varbind.type === snmp.ObjectType.EndOfMibView) {
            finish();
            return;
          }
          continue;
        }

        if (varbind.value === null || varbind.value === undefined) {
          continue;
        }

        currentChunk[String(varbind.oid)] = stringifyVarbindValue(
          varbind.value,
        );
      }

      if (Object.keys(currentChunk).length >= chunkSize) {
        flushCurrentChunk();
      }
    };

    const feedCallback = (varbinds: snmp.Varbind[]) => {
      try {
        processVarbinds(null, varbinds);
      } catch (error) {
        console.error(
          `[SNMP-Optimized] Callback error:`,
          normalizeSnmpError(error),
        );
      }
    };

    const doneCallback = (error?: Error) => {
      if (error) {
        console.error(`[SNMP-Optimized] Subtree error:`, error.message);
        finish(error);
        return;
      }

      finish();
    };

    try {
      session.subtree(oid, SUBTREE_MAX_REPETITIONS, feedCallback, doneCallback);
    } catch (error) {
      console.error(
        `[SNMP-Optimized] Subtree setup error:`,
        normalizeSnmpError(error),
      );
      finish(error as Error);
      return;
    }

    setTimeout(() => {
      clearTimeout(timeoutId);
    }, timeout + POST_TIMEOUT_GRACE_MS);
  });
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
): Promise<OnuPaginationResult> {
  const statusCacheKey = getCacheKey(ipAddress, STATUS_NEW_OID);
  let statusData = getFromCache(statusCacheKey);

  if (!statusData) {
    statusData = await fetchStatusDataset(ipAddress, port, community, version);
    if (hasSnmpResults(statusData)) {
      setCache(statusCacheKey, statusData);
    }
  }

  const totalOnus = Object.keys(statusData).length;
  if (totalOnus === 0) {
    return { data: [], pagination: buildEmptyPagination(pageSize) };
  }

  const indexes = getPagedIndexes(statusData, page, pageSize);
  const datasets = await fetchOnuDatasets({
    ipAddress,
    port,
    community,
    version,
    timeout: resolveOnuDataTimeout(totalOnus),
    statusData,
  });

  return {
    data: buildPaginatedOnuItems({ indexes, oltId, datasets }),
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
  clearSNMPCache();
}

if (typeof process !== "undefined") {
  process.on("SIGINT", cleanupSNMPConnections);
  process.on("SIGTERM", cleanupSNMPConnections);
  process.on("beforeExit", cleanupSNMPConnections);
}
