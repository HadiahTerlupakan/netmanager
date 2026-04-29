import snmp from "net-snmp";
import {
  DEFAULT_MAX_REPETITIONS,
  DEFAULT_SNMP_TIMEOUT,
  LARGE_MAX_REPETITIONS,
} from "./constants";
import {
  compareOids,
  isOidInSubtree,
  normalizeOid,
  stringifySnmpValue,
} from "./oid-utils";
import { closeSnmpSession, createSnmpSession } from "./session";

/** Read a subtree with SNMP GETBULK. */
export async function snmpGetBulkSimple(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oid: string,
  timeout: number = 30_000,
  maxResults?: number,
  expectedCount?: number,
): Promise<Record<string, string>> {
  return snmpGetBulk({
    ipAddress,
    port,
    community,
    version,
    oid,
    timeout,
    maxResults,
    expectedCount,
  });
}

/** Execute a low-level GETBULK query and aggregate subtree values. */
export async function snmpGetBulk(params: {
  ipAddress: string;
  port: number;
  community: string;
  version: string;
  oid: string;
  timeout?: number;
  maxResults?: number;
  expectedCount?: number;
}): Promise<Record<string, string>> {
  const {
    ipAddress,
    port,
    community,
    version,
    oid,
    timeout = DEFAULT_SNMP_TIMEOUT,
    maxResults,
    expectedCount,
  } = params;

  return new Promise((resolve, reject) => {
    let isResolved = false;
    let session: snmp.Session | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let currentOid = oid;
    const results: Record<string, string> = {};
    const normalizedBaseOid = normalizeOid(oid);
    const maxRepetitions =
      expectedCount && expectedCount > 100
        ? LARGE_MAX_REPETITIONS
        : DEFAULT_MAX_REPETITIONS;

    const finish = (error?: Error | string | null) => {
      if (isResolved) return;
      isResolved = true;
      if (timeoutId) clearTimeout(timeoutId);
      closeSnmpSession(session);
      session = null;

      if (error && Object.keys(results).length === 0) {
        reject(error);
        return;
      }

      resolve(results);
    };

    const shouldStop = () => {
      if (
        maxResults !== undefined &&
        Object.keys(results).length >= maxResults
      ) {
        return true;
      }

      if (
        expectedCount !== undefined &&
        Object.keys(results).length >= expectedCount
      ) {
        return true;
      }

      return false;
    };

    const collectVarbinds = (
      varbinds: Array<snmp.Varbind | snmp.Varbind[]>,
    ): snmp.Varbind[] => {
      return varbinds.reduce<snmp.Varbind[]>((collection, item) => {
        if (Array.isArray(item)) {
          collection.push(...item);
          return collection;
        }

        collection.push(item);
        return collection;
      }, []);
    };

    const requestNextBatch = () => {
      if (isResolved || shouldStop() || !session) {
        finish();
        return;
      }

      session.getBulk(
        [normalizeOid(currentOid)],
        0,
        maxRepetitions,
        (error, varbinds) => {
          if (isResolved) return;
          if (error) {
            finish(error);
            return;
          }
          if (!varbinds?.length) {
            finish(new Error("GETBULK returned empty varbinds"));
            return;
          }

          let nextOid: string | null = null;
          let hasValidVarbind = false;

          for (const varbind of collectVarbinds(varbinds)) {
            if (!varbind?.oid) continue;
            if (snmp.isVarbindError(varbind)) continue;

            const varbindOid = String(varbind.oid);
            if (!isOidInSubtree(varbindOid, normalizedBaseOid)) {
              finish();
              return;
            }

            hasValidVarbind = true;
            const oidParts = normalizeOid(varbindOid).split(".");
            const baseParts = normalizedBaseOid.split(".");
            const index = oidParts.slice(baseParts.length).join(".");

            if (index) {
              results[index] = stringifySnmpValue(varbind.value);
            }

            if (!nextOid || compareOids(varbindOid, nextOid) > 0) {
              nextOid = varbindOid;
            }
          }

          if (!hasValidVarbind || !nextOid || nextOid === currentOid) {
            finish();
            return;
          }

          currentOid = nextOid;
          requestNextBatch();
        },
      );
    };

    try {
      session = createSnmpSession({
        ipAddress,
        port,
        community,
        version,
        timeout: DEFAULT_SNMP_TIMEOUT,
      });
      timeoutId = setTimeout(
        () =>
          finish(
            Object.keys(results).length
              ? null
              : new Error("SNMP GETBULK timeout"),
          ),
        timeout,
      );
      requestNextBatch();
    } catch (error) {
      finish(error instanceof Error ? error : String(error));
    }
  });
}
