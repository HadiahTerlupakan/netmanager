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

function queueVarbinds(
  state: SubtreeWalkState,
  varbinds: snmp.Varbind[],
): void {
  state.pendingVarbinds.push(...varbinds);
}

function hasPendingBatches(state: SubtreeWalkState): boolean {
  return state.pendingVarbinds.length > 0;
}

function takeBatch(state: SubtreeWalkState): snmp.Varbind[] {
  return state.pendingVarbinds.splice(0, BATCH_SIZE);
}

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
    const state = createWalkState(maxResults, expectedCount);
    let session: snmp.Session | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let stabilityTimeout: ReturnType<typeof setTimeout> | null = null;

    const finish = (error?: Error | string | null) => {
      if (state.isResolved) return;
      state.isResolved = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (stabilityTimeout) clearTimeout(stabilityTimeout);
      closeSnmpSession(session);
      session = null;

      if (error && state.results.length === 0) {
        reject(error);
        return;
      }

      resolve(state.results);
    };

    const scheduleStabilityCheck = () => {
      if (state.isResolved) return;
      stabilityTimeout = setTimeout(() => {
        if (shouldStopForStability(state)) {
          finish();
          return;
        }

        scheduleStabilityCheck();
      }, STABILITY_CHECK_INTERVAL_MS);
    };

    const flushBatch = () => {
      if (state.isProcessing || !hasPendingBatches(state) || state.isResolved) {
        return;
      }

      state.pendingVarbinds.unshift(...takeBatch(state));
      const batchResult = flushSubtreeBatch(state, oid);
      if (batchResult.shouldFinish) {
        finish();
        return;
      }

      if (hasPendingBatches(state)) {
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
        () =>
          finish(state.results.length ? null : new Error("SNMP walk timeout")),
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
          if (state.isResolved) return;
          queueVarbinds(state, varbinds);
          flushBatch();
        },
        (error?: Error): void => finish(error ?? null),
      );
    } catch (error) {
      finish(error instanceof Error ? error : String(error));
    }
  });
}
