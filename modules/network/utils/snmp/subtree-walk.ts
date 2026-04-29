import snmp from "net-snmp";
import {
  BATCH_DELAY_MS,
  DEFAULT_SNMP_TIMEOUT,
  STABILITY_CHECK_INTERVAL_MS,
  SUBTREE_MAX_REPETITIONS,
} from "./constants";
import { isOidInSubtree, normalizeOid } from "./oid-utils";
import { closeSnmpSession, createSnmpSession } from "./session";
import type { SnmpWalkResult } from "./types";

/** Walk an SNMP subtree using subtree batching. */
export async function snmpWalkWithSubtree(params: {
  ipAddress: string;
  port: number;
  community: string;
  version: string;
  oid: string;
  timeout: number;
  maxResults?: number;
  expectedCount?: number;
}): Promise<SnmpWalkResult[]> {
  const {
    ipAddress,
    port,
    community,
    version,
    oid,
    timeout,
    maxResults,
    expectedCount,
  } = params;

  return new Promise((resolve, reject) => {
    let isResolved = false;
    let session: snmp.Session | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let stabilityTimeout: ReturnType<typeof setTimeout> | null = null;
    const results: SnmpWalkResult[] = [];
    const pendingVarbinds: snmp.Varbind[] = [];
    let isProcessing = false;
    let lastCount = 0;
    let stableRounds = 0;

    const finish = (error?: Error | string | null) => {
      if (isResolved) return;
      isResolved = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (stabilityTimeout) clearTimeout(stabilityTimeout);
      closeSnmpSession(session);
      session = null;

      if (error && results.length === 0) {
        reject(error);
        return;
      }

      resolve(results);
    };

    const hasReachedLimit = () => {
      if (maxResults !== undefined && results.length >= maxResults) {
        return true;
      }

      if (expectedCount !== undefined && results.length >= expectedCount) {
        return true;
      }

      return false;
    };

    const scheduleStabilityCheck = () => {
      if (isResolved) return;
      stabilityTimeout = setTimeout(() => {
        if (results.length === lastCount || hasReachedLimit()) {
          stableRounds += 1;
        } else {
          stableRounds = 0;
          lastCount = results.length;
        }

        if (stableRounds >= 2) {
          finish();
          return;
        }

        scheduleStabilityCheck();
      }, STABILITY_CHECK_INTERVAL_MS);
    };

    const flushBatch = () => {
      if (isProcessing || pendingVarbinds.length === 0 || isResolved) {
        return;
      }

      isProcessing = true;
      const batch = pendingVarbinds.splice(0, SUBTREE_MAX_REPETITIONS);

      for (const varbind of batch) {
        if (snmp.isVarbindError(varbind)) {
          continue;
        }

        const varbindOid = String(varbind.oid);
        if (!isOidInSubtree(varbindOid, oid)) {
          finish();
          isProcessing = false;
          return;
        }

        results.push({
          oid: varbindOid,
          value: varbind.value,
          type: varbind.type,
        });
        if (hasReachedLimit()) {
          finish();
          isProcessing = false;
          return;
        }
      }

      isProcessing = false;
      if (pendingVarbinds.length > 0) {
        setTimeout(flushBatch, BATCH_DELAY_MS);
      }
    };

    try {
      session = createSnmpSession({
        ipAddress,
        port,
        community,
        version,
        timeout: DEFAULT_SNMP_TIMEOUT,
        retries: 3,
      });
      timeoutId = setTimeout(
        () => finish(results.length ? null : new Error("SNMP walk timeout")),
        timeout,
      );
      scheduleStabilityCheck();

      const subtreeSession = session as unknown as {
        subtree: (
          oid: string,
          maxRepetitions: number,
          feedCallback: (varbinds: snmp.Varbind[]) => void,
          doneCallback: (error?: Error) => void,
        ) => void;
      };

      subtreeSession.subtree(
        normalizeOid(oid),
        SUBTREE_MAX_REPETITIONS,
        (varbinds: snmp.Varbind[]): void => {
          if (isResolved) return;
          pendingVarbinds.push(...varbinds);
          flushBatch();
        },
        (error?: Error): void => finish(error ?? null),
      );
    } catch (error) {
      finish(error instanceof Error ? error : String(error));
    }
  });
}
