import {
  compareOids,
  normalizeOid,
  stringifySnmpValue,
  validateOidSequence,
} from "./oid-utils";
import type { SnmpWalkResult } from "./types";
import { snmpGetBulkSimple } from "./get-bulk";
import { snmpWalkWithGetNext } from "./get-next";
import { snmpWalkWithSubtree } from "./subtree-walk";

/** Walk an SNMP subtree and return normalized item records. */
export async function snmpWalk(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oid: string,
  timeout: number = 60_000,
  maxResults?: number,
  expectedCount?: number,
): Promise<SnmpWalkResult[]> {
  return snmpWalkWithSubtree({
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

/** Walk an SNMP subtree and return a keyed record. */
export async function snmpWalkSimple(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oid: string,
  timeout: number = 120_000,
  maxResults?: number,
  expectedCount?: number,
): Promise<Record<string, string>> {
  if (version === "2c" || version === "2") {
    const bulkResults = await snmpGetBulkSimple(
      ipAddress,
      port,
      community,
      version,
      oid,
      timeout,
      maxResults,
      expectedCount,
    ).catch(() => ({}));

    if (Object.keys(bulkResults).length > 0) {
      return bulkResults;
    }
  }

  let walkResults = await snmpWalk(
    ipAddress,
    port,
    community,
    version,
    oid,
    timeout,
    maxResults,
    expectedCount,
  );

  if (expectedCount !== undefined && walkResults.length < expectedCount) {
    const fallbackResults = await snmpWalkWithGetNext(
      ipAddress,
      port,
      community,
      version,
      oid,
      timeout,
      expectedCount,
    ).catch((): SnmpWalkResult[] => []);

    if (fallbackResults.length > walkResults.length) {
      walkResults = fallbackResults;
    }
  }

  walkResults.sort((left, right) => compareOids(left.oid, right.oid));
  validateOidSequence(walkResults, oid);
  return mapWalkResultsToRecord(oid, walkResults);
}

/** Convert walk results into a subtree index-to-value record. */
function mapWalkResultsToRecord(
  baseOid: string,
  walkResults: SnmpWalkResult[],
): Record<string, string> {
  const baseLength = normalizeOid(baseOid).split(".").filter(Boolean).length;

  return walkResults.reduce<Record<string, string>>((record, item) => {
    const oidParts = normalizeOid(item.oid).split(".").filter(Boolean);
    const rawIndex =
      oidParts.slice(baseLength).join(".") || oidParts.slice(-2).join(".");
    const normalizedIndex = shouldTrimLastSegment(baseOid, rawIndex)
      ? rawIndex.slice(0, -2)
      : rawIndex;
    record[normalizedIndex] = stringifySnmpValue(item.value);
    return record;
  }, {});
}

/** Decide whether a walk result index should drop a trailing '.1'. */
function shouldTrimLastSegment(baseOid: string, index: string): boolean {
  const supportsTrailingSuffix = [
    "1.3.6.1.4.1.3902.1012.3.50.12.1.1.10",
    "1.3.6.1.4.1.3902.1082.500.20.2.17.2.1.11",
  ];

  return supportsTrailingSuffix.includes(baseOid) && index.endsWith(".1");
}
