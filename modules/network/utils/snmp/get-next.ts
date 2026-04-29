import snmp from "net-snmp";
import {
  DEFAULT_SNMP_TIMEOUT,
  LARGE_SNMP_TIMEOUT,
  GET_NEXT_DELAY_MS,
} from "./constants";
import { compareOids, isOidInSubtree, normalizeOid } from "./oid-utils";
import { closeSnmpSession, createSnmpSession } from "./session";
import type { SnmpWalkResult } from "./types";

/** Walk an SNMP subtree sequentially using GETNEXT. */
export async function snmpWalkWithGetNext(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oid: string,
  timeout: number = LARGE_SNMP_TIMEOUT,
  expectedCount?: number,
): Promise<SnmpWalkResult[]> {
  return new Promise((resolve, reject) => {
    let isResolved = false;
    let session: snmp.Session | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let currentOid: string | null = normalizeOid(oid);
    const results: SnmpWalkResult[] = [];

    const finish = (error?: Error | string | null) => {
      if (isResolved) return;
      isResolved = true;
      if (timeoutId) clearTimeout(timeoutId);
      closeSnmpSession(session);
      session = null;

      if (error && results.length === 0) {
        reject(error);
        return;
      }

      results.sort((left, right) => compareOids(left.oid, right.oid));
      resolve(results);
    };

    const requestNext = () => {
      if (isResolved || !currentOid || !session) {
        finish();
        return;
      }

      session.getNext([currentOid], (error, varbinds) => {
        if (isResolved) return;
        if (error) {
          finish(error);
          return;
        }

        const varbind = varbinds?.[0];
        if (!varbind || snmp.isVarbindError(varbind)) {
          finish();
          return;
        }

        const nextOid = String(varbind.oid);
        if (!isOidInSubtree(nextOid, oid)) {
          finish();
          return;
        }

        results.push({
          oid: nextOid,
          value: varbind.value,
          type: varbind.type,
        });
        if (expectedCount !== undefined && results.length >= expectedCount) {
          finish();
          return;
        }

        currentOid = nextOid;
        setTimeout(requestNext, GET_NEXT_DELAY_MS);
      });
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
        () => finish(results.length ? null : new Error("SNMP getNext timeout")),
        timeout,
      );
      requestNext();
    } catch (error) {
      finish(error instanceof Error ? error : String(error));
    }
  });
}
