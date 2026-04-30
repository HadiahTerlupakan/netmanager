import snmp from "net-snmp";
import { isOidInSubtree } from "./oid-utils";
import type { SnmpWalkResult } from "./types";

export type SubtreeWalkState = {
  isResolved: boolean;
  results: SnmpWalkResult[];
  pendingVarbinds: snmp.Varbind[];
  isProcessing: boolean;
  lastCount: number;
  stableRounds: number;
  maxResults?: number;
  expectedCount?: number;
};

/** Check whether subtree walk reached the configured limit. */
export function hasReachedSubtreeLimit(state: SubtreeWalkState): boolean {
  if (
    state.maxResults !== undefined &&
    state.results.length >= state.maxResults
  ) {
    return true;
  }

  if (
    state.expectedCount !== undefined &&
    state.results.length >= state.expectedCount
  ) {
    return true;
  }

  return false;
}

/** Update stability counters for subtree walk completion detection. */
export function updateStability(state: SubtreeWalkState): boolean {
  if (
    state.results.length === state.lastCount ||
    hasReachedSubtreeLimit(state)
  ) {
    state.stableRounds += 1;
  } else {
    state.stableRounds = 0;
    state.lastCount = state.results.length;
  }

  return state.stableRounds >= 2;
}

/** Flush pending subtree varbinds into walk results. */
export function flushSubtreeBatch(
  state: SubtreeWalkState,
  subtreeOid: string,
): { shouldFinish: boolean } {
  if (
    state.isProcessing ||
    state.pendingVarbinds.length === 0 ||
    state.isResolved
  ) {
    return { shouldFinish: false };
  }

  state.isProcessing = true;
  const batch = state.pendingVarbinds.splice(0, state.pendingVarbinds.length);

  for (const varbind of batch) {
    if (snmp.isVarbindError(varbind)) {
      continue;
    }

    const varbindOid = String(varbind.oid);
    if (!isOidInSubtree(varbindOid, subtreeOid)) {
      state.isProcessing = false;
      return { shouldFinish: true };
    }

    state.results.push({
      oid: varbindOid,
      value: varbind.value,
      type: varbind.type,
    });

    if (hasReachedSubtreeLimit(state)) {
      state.isProcessing = false;
      return { shouldFinish: true };
    }
  }

  state.isProcessing = false;
  return { shouldFinish: false };
}
