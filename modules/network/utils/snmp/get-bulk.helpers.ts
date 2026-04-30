import snmp from "net-snmp";
import {
  compareOids,
  isOidInSubtree,
  normalizeOid,
  stringifySnmpValue,
} from "./oid-utils";

export type BulkState = {
  isResolved: boolean;
  session: snmp.Session | null;
  timeoutId: ReturnType<typeof setTimeout> | null;
  currentOid: string;
  results: Record<string, string>;
  normalizedBaseOid: string;
  maxResults?: number;
  expectedCount?: number;
};

/** Flatten GETBULK response items into a single varbind list. */
export function collectVarbinds(
  varbinds: Array<snmp.Varbind | snmp.Varbind[]>,
): snmp.Varbind[] {
  return varbinds.reduce<snmp.Varbind[]>((collection, item) => {
    if (Array.isArray(item)) {
      collection.push(...item);
      return collection;
    }

    collection.push(item);
    return collection;
  }, []);
}

/** Check whether GETBULK has reached configured limits. */
export function hasReachedBulkLimit(state: BulkState): boolean {
  if (
    state.maxResults !== undefined &&
    Object.keys(state.results).length >= state.maxResults
  ) {
    return true;
  }

  if (
    state.expectedCount !== undefined &&
    Object.keys(state.results).length >= state.expectedCount
  ) {
    return true;
  }

  return false;
}

/** Process a GETBULK response batch and advance cursor. */
export function processBulkBatch(
  state: BulkState,
  varbinds: Array<snmp.Varbind | snmp.Varbind[]>,
): { shouldFinish: boolean } {
  let nextOid: string | null = null;
  let hasValidVarbind = false;

  for (const varbind of collectVarbinds(varbinds)) {
    if (!varbind?.oid || snmp.isVarbindError(varbind)) {
      continue;
    }

    const varbindOid = String(varbind.oid);
    if (!isOidInSubtree(varbindOid, state.normalizedBaseOid)) {
      return { shouldFinish: true };
    }

    hasValidVarbind = true;
    const index = extractSubtreeIndex(varbindOid, state.normalizedBaseOid);
    if (index) {
      state.results[index] = stringifySnmpValue(varbind.value);
    }

    if (!nextOid || compareOids(varbindOid, nextOid) > 0) {
      nextOid = varbindOid;
    }
  }

  if (!hasValidVarbind || !nextOid || nextOid === state.currentOid) {
    return { shouldFinish: true };
  }

  state.currentOid = nextOid;
  return { shouldFinish: false };
}

function extractSubtreeIndex(
  varbindOid: string,
  normalizedBaseOid: string,
): string {
  const oidParts = normalizeOid(varbindOid).split(".");
  const baseParts = normalizedBaseOid.split(".");
  return oidParts.slice(baseParts.length).join(".");
}
