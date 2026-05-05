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

type BulkParams = {
  ipAddress: string;
  port: number;
  community: string;
  version: string;
  oid: string;
  timeout?: number;
  maxResults?: number;
  expectedCount?: number;
};

export function createBulkState(
  oid: string,
  maxResults?: number,
  expectedCount?: number,
): BulkState {
  return {
    isResolved: false,
    session: null,
    timeoutId: null,
    currentOid: oid,
    results: {},
    normalizedBaseOid: normalizeOid(oid),
    maxResults,
    expectedCount,
  };
}

function getBulkMaxRepetitions(expectedCount?: number) {
  return expectedCount && expectedCount > 100
    ? LARGE_MAX_REPETITIONS
    : DEFAULT_MAX_REPETITIONS;
}

export function createBulkFinishHandler(
  state: BulkState,
  resolve: (value: Record<string, string>) => void,
  reject: (reason?: unknown) => void,
  closeSession: () => void,
) {
  return (error?: Error | string | null) => {
    if (state.isResolved) return;
    state.isResolved = true;
    if (state.timeoutId) clearTimeout(state.timeoutId);
    closeSession();

    if (error && Object.keys(state.results).length === 0) {
      reject(error);
      return;
    }

    resolve(state.results);
  };
}

export function requestBulkBatch(
  state: BulkState,
  maxRepetitions: number,
  finish: (error?: Error | string | null) => void,
) {
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
      if (error) return finish(error);
      if (!varbinds?.length) {
        return finish(new Error("GETBULK returned empty varbinds"));
      }

      if (processBulkBatch(state, varbinds).shouldFinish) {
        return finish();
      }

      requestBulkBatch(state, maxRepetitions, finish);
    },
  );
}

function createBulkSession(
  params: Pick<BulkParams, "ipAddress" | "port" | "community" | "version">,
) {
  return createSnmpSession({
    ipAddress: params.ipAddress,
    port: params.port,
    community: params.community,
    version: params.version,
    timeout: DEFAULT_SNMP_TIMEOUT,
  });
}

function scheduleBulkTimeout(
  state: BulkState,
  timeout: number,
  finish: (error?: Error | string | null) => void,
) {
  return setTimeout(
    () =>
      finish(
        Object.keys(state.results).length
          ? null
          : new Error("SNMP GETBULK timeout"),
      ),
    timeout,
  );
}

export function executeBulkRequest(params: BulkParams) {
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

  return new Promise<Record<string, string>>((resolve, reject) => {
    const state = createBulkState(oid, maxResults, expectedCount);
    const finish = createBulkFinishHandler(state, resolve, reject, () => {
      closeSnmpSession(state.session);
      state.session = null;
    });

    try {
      state.session = createBulkSession({
        ipAddress,
        port,
        community,
        version,
      });
      state.timeoutId = scheduleBulkTimeout(state, timeout, finish);
      requestBulkBatch(state, getBulkMaxRepetitions(expectedCount), finish);
    } catch (error) {
      finish(error instanceof Error ? error : String(error));
    }
  });
}
