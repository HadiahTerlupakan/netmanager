import {
  DEFAULT_MAX_REPETITIONS,
  DEFAULT_SNMP_TIMEOUT,
  LARGE_MAX_REPETITIONS,
} from "./constants";
import { normalizeOid } from "./oid-utils";
import { closeSnmpSession, createSnmpSession } from "./session";
import {
  hasReachedBulkLimit,
  processBulkBatch,
  type BulkState,
} from "./get-bulk.helpers";

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
    const state: BulkState = {
      isResolved: false,
      session: null,
      timeoutId: null,
      currentOid: oid,
      results: {},
      normalizedBaseOid: normalizeOid(oid),
      maxResults,
      expectedCount,
    };
    const maxRepetitions =
      expectedCount && expectedCount > 100
        ? LARGE_MAX_REPETITIONS
        : DEFAULT_MAX_REPETITIONS;

    const finish = (error?: Error | string | null) => {
      if (state.isResolved) return;
      state.isResolved = true;
      if (state.timeoutId) clearTimeout(state.timeoutId);
      closeSnmpSession(state.session);
      state.session = null;

      if (error && Object.keys(state.results).length === 0) {
        reject(error);
        return;
      }

      resolve(state.results);
    };

    const requestNextBatch = () => {
      if (state.isResolved || hasReachedBulkLimit(state) || !state.session) {
        finish();
        return;
      }

      state.session.getBulk(
        [normalizeOid(state.currentOid)],
        0,
        maxRepetitions,
        (error, varbinds) => {
          if (state.isResolved) return;
          if (error) {
            finish(error);
            return;
          }
          if (!varbinds?.length) {
            finish(new Error("GETBULK returned empty varbinds"));
            return;
          }

          const batchResult = processBulkBatch(state, varbinds);
          if (batchResult.shouldFinish) {
            finish();
            return;
          }

          requestNextBatch();
        },
      );
    };

    try {
      state.session = createSnmpSession({
        ipAddress,
        port,
        community,
        version,
        timeout: DEFAULT_SNMP_TIMEOUT,
      });
      state.timeoutId = setTimeout(
        () =>
          finish(
            Object.keys(state.results).length
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
