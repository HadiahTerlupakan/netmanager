import snmp from "net-snmp";

import {
  BATCH_DELAY_MS,
  DEFAULT_SNMP_TIMEOUT,
  STABILITY_CHECK_INTERVAL_MS,
  SUBTREE_MAX_REPETITIONS,
} from "./constants";
import { normalizeOid } from "./oid-utils";
import { closeSnmpSession, createSnmpSession } from "./session";
import {
  flushSubtreeBatch,
  type SubtreeWalkState,
  updateStability,
} from "./subtree-walk.helpers";
import type { SnmpWalkResult } from "./types";

const BATCH_SIZE = SUBTREE_MAX_REPETITIONS;
const STABLE_ROUND_LIMIT = 2;

type WalkParams = {
  ipAddress: string;
  port: number;
  community: string;
  version: string;
  oid: string;
  timeout: number;
  maxResults?: number;
  expectedCount?: number;
};

function createWalkState(
  maxResults?: number,
  expectedCount?: number,
): SubtreeWalkState {
  return {
    isResolved: false,
    results: [],
    pendingVarbinds: [],
    isProcessing: false,
    lastCount: 0,
    stableRounds: 0,
    maxResults,
    expectedCount,
  };
}

function shouldStopForStability(state: SubtreeWalkState): boolean {
  return updateStability(state) || state.stableRounds >= STABLE_ROUND_LIMIT;
}

function queueVarbinds(state: SubtreeWalkState, varbinds: snmp.Varbind[]) {
  state.pendingVarbinds.push(...varbinds);
}

function takeBatch(state: SubtreeWalkState): snmp.Varbind[] {
  return state.pendingVarbinds.splice(0, BATCH_SIZE);
}

function createWalkFinishHandler(
  state: SubtreeWalkState,
  resolve: (value: SnmpWalkResult[]) => void,
  reject: (reason?: unknown) => void,
  closeSession: () => void,
  cleanupTimers: () => void,
) {
  return (error?: Error | string | null) => {
    if (state.isResolved) return;
    state.isResolved = true;
    cleanupTimers();
    closeSession();

    if (error && state.results.length === 0) {
      reject(error);
      return;
    }

    resolve(state.results);
  };
}

function scheduleStabilityCheck(
  state: SubtreeWalkState,
  finish: (error?: Error | string | null) => void,
  setTimer: (timer: ReturnType<typeof setTimeout>) => void,
) {
  if (state.isResolved) return;

  const timer = setTimeout(() => {
    if (shouldStopForStability(state)) {
      finish();
      return;
    }

    scheduleStabilityCheck(state, finish, setTimer);
  }, STABILITY_CHECK_INTERVAL_MS);
  setTimer(timer);
}

function flushWalkBatch(
  state: SubtreeWalkState,
  subtreeOid: string,
  finish: (error?: Error | string | null) => void,
) {
  if (
    state.isProcessing ||
    state.pendingVarbinds.length === 0 ||
    state.isResolved
  ) {
    return;
  }

  state.pendingVarbinds.unshift(...takeBatch(state));
  const batchResult = flushSubtreeBatch(state, subtreeOid);
  if (batchResult.shouldFinish) {
    finish();
    return;
  }

  if (state.pendingVarbinds.length > 0) {
    setTimeout(() => flushWalkBatch(state, subtreeOid, finish), BATCH_DELAY_MS);
  }
}

function createWalkSession(
  params: Pick<WalkParams, "ipAddress" | "port" | "community" | "version">,
) {
  return createSnmpSession({
    ipAddress: params.ipAddress,
    port: params.port,
    community: params.community,
    version: params.version,
    timeout: DEFAULT_SNMP_TIMEOUT,
    retries: 3,
  });
}

function scheduleWalkTimeout(
  state: SubtreeWalkState,
  timeout: number,
  finish: (error?: Error | string | null) => void,
) {
  return setTimeout(
    () => finish(state.results.length ? null : new Error("SNMP walk timeout")),
    timeout,
  );
}

function startSubtreeSession(
  session: snmp.Session,
  state: SubtreeWalkState,
  oid: string,
  finish: (error?: Error | string | null) => void,
) {
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
    (varbinds: snmp.Varbind[]) => {
      if (state.isResolved) return;
      queueVarbinds(state, varbinds);
      flushWalkBatch(state, oid, finish);
    },
    (error?: Error) => finish(error ?? null),
  );
}

type WalkRuntime = {
  session: snmp.Session | null;
  timeoutId: ReturnType<typeof setTimeout> | null;
  stabilityTimeout: ReturnType<typeof setTimeout> | null;
};

function createWalkRuntime(): WalkRuntime {
  return {
    session: null,
    timeoutId: null,
    stabilityTimeout: null,
  };
}

function cleanupWalkRuntime(runtime: WalkRuntime) {
  closeSnmpSession(runtime.session);
  runtime.session = null;
  if (runtime.timeoutId) clearTimeout(runtime.timeoutId);
  if (runtime.stabilityTimeout) clearTimeout(runtime.stabilityTimeout);
}

function initializeWalkExecution(
  params: WalkParams,
  state: SubtreeWalkState,
  runtime: WalkRuntime,
  finish: (error?: Error | string | null) => void,
) {
  runtime.session = createWalkSession(params);
  runtime.timeoutId = scheduleWalkTimeout(state, params.timeout, finish);
  scheduleStabilityCheck(state, finish, (timer) => {
    runtime.stabilityTimeout = timer;
  });
  startSubtreeSession(runtime.session, state, params.oid, finish);
}

/** Jalankan subtree walk SNMP dengan batching dan stop stabilitas. */
export function executeSubtreeWalk(
  params: WalkParams,
): Promise<SnmpWalkResult[]> {
  return new Promise((resolve, reject) => {
    const state = createWalkState(params.maxResults, params.expectedCount);
    const runtime = createWalkRuntime();
    const finish = createWalkFinishHandler(
      state,
      resolve,
      reject,
      () => cleanupWalkRuntime(runtime),
      () => undefined,
    );

    try {
      initializeWalkExecution(params, state, runtime, finish);
    } catch (error) {
      finish(error instanceof Error ? error : String(error));
    }
  });
}
