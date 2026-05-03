import * as snmp from "net-snmp";
import { snmpGetBulkSimple } from "@/modules/network/services/snmpService";
import {
  MAX_CHUNK_SIZE,
  POST_TIMEOUT_GRACE_MS,
  SNMP_TIMEOUT_MS,
  SUBTREE_MAX_REPETITIONS,
} from "@/modules/network/services/snmp-optimized.constants";
import { SNMPConnectionPoolService } from "./snmp-connection-pool.service";

export function normalizeSnmpError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function hasSnmpResults(record: Record<string, string>): boolean {
  return Object.keys(record).length > 0;
}

export function stringifyVarbindValue(value: unknown): string {
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

/** Optimized SNMP fetch: GETBULK lalu fallback subtree walk. */
export async function snmpWalkOptimized(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oid: string,
  connectionPool: SNMPConnectionPoolService,
  options: {
    timeout?: number;
    useCache?: boolean;
    chunkSize?: number;
    cacheService?: {
      get: (key: string) => Record<string, string> | null;
      set: (key: string, data: Record<string, string>) => void;
      getCacheKey: (ipAddress: string, oid: string) => string;
    };
  } = {},
): Promise<Record<string, string>> {
  const {
    timeout = SNMP_TIMEOUT_MS,
    useCache = true,
    chunkSize = MAX_CHUNK_SIZE,
    cacheService,
  } = options;

  const cacheKey =
    cacheService?.getCacheKey(ipAddress, oid) ?? `${ipAddress}:${oid}`;

  if (useCache) {
    const cached = cacheService?.get(cacheKey);
    if (cached) return cached;
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

    if (useCache && cacheService && hasSnmpResults(results)) {
      cacheService.set(cacheKey, results);
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

      if (useCache && cacheService && hasSnmpResults(results)) {
        cacheService.set(cacheKey, results);
      }

      return results;
    } finally {
      connectionPool.releaseSession(session);
    }
  }
}

/** SNMP subtree walk dengan chunking untuk dataset besar. */
export async function snmpWalkWithChunking(
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
      Object.assign(results, currentChunk);
      currentChunk = {};

      if (error && !hasSnmpResults(results)) {
        reject(error);
        return;
      }
      resolve(results);
    };

    const timeoutId = setTimeout(() => finish(), timeout);

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

        if (varbind.value === null || varbind.value === undefined) continue;

        currentChunk[String(varbind.oid)] = stringifyVarbindValue(
          varbind.value,
        );
      }

      if (Object.keys(currentChunk).length >= chunkSize) {
        Object.assign(results, currentChunk);
        currentChunk = {};
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
    }

    setTimeout(() => clearTimeout(timeoutId), timeout + POST_TIMEOUT_GRACE_MS);
  });
}
