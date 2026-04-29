import snmp from "net-snmp";
import { BATCH_DELAY_MS, DEFAULT_SNMP_TIMEOUT } from "./constants";
import { isOidInSubtree, normalizeOid, stringifySnmpValue } from "./oid-utils";
import { closeSnmpSession, createSnmpSession } from "./session";

/** Fetch an SNMP table with multiple columns in one subtree scan. */
export async function snmpTable(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  baseOid: string,
  columns: string[],
  timeout: number = 30_000,
): Promise<Record<string, string>> {
  const fullOids = columns.map((column) => buildColumnOid(baseOid, column));
  const columnNumbers = fullOids.reduce<Record<string, string>>(
    (mapping, fullOid, index) => {
      mapping[normalizeOid(fullOid)] =
        columns[index] ?? fullOid.split(".").pop() ?? fullOid;
      return mapping;
    },
    {},
  );

  return new Promise((resolve) => {
    let isResolved = false;
    let session: snmp.Session | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const results: Record<string, string> = {};
    let currentOids = fullOids.map(normalizeOid);
    const finishedColumns = new Array(currentOids.length).fill(false);

    const finish = () => {
      if (isResolved) return;
      isResolved = true;
      if (timeoutId) clearTimeout(timeoutId);
      closeSnmpSession(session);
      session = null;
      resolve(results);
    };

    const requestBulk = () => {
      if (isResolved || !session) {
        finish();
        return;
      }

      session.getBulk(currentOids, 0, 100, (error, varbinds) => {
        if (isResolved) return;
        if (error || !varbinds?.length) {
          finish();
          return;
        }

        const flattened = varbinds.flatMap((item) =>
          Array.isArray(item) ? item : [item],
        );
        const nextOids = [...currentOids];
        let hasNewData = false;

        for (const varbind of flattened) {
          if (!varbind?.oid) continue;
          const varbindOid = normalizeOid(String(varbind.oid));
          const matchedIndex = currentOids.findIndex((columnOid, index) => {
            return (
              !finishedColumns[index] && isOidInSubtree(varbindOid, columnOid)
            );
          });

          if (matchedIndex < 0) continue;
          if (snmp.isVarbindError(varbind)) {
            finishedColumns[matchedIndex] = true;
            continue;
          }

          const columnOid = currentOids[matchedIndex];
          if (!columnOid) continue;
          const keySuffix = normalizeOid(varbindOid)
            .split(".")
            .slice(columnOid.split(".").length)
            .join(".");
          if (!keySuffix) continue;

          results[`${columnNumbers[columnOid]}.${keySuffix}`] =
            stringifySnmpValue(varbind.value);
          nextOids[matchedIndex] = varbindOid;
          hasNewData = true;
        }

        currentOids = nextOids;
        if (!hasNewData || finishedColumns.every(Boolean)) {
          finish();
          return;
        }

        setTimeout(requestBulk, BATCH_DELAY_MS);
      });
    };

    try {
      session = createSnmpSession({
        ipAddress,
        port,
        community,
        version,
        timeout: DEFAULT_SNMP_TIMEOUT,
      });
      timeoutId = setTimeout(finish, timeout);
      requestBulk();
    } catch {
      finish();
    }
  });
}

/** Build a column OID from base and relative column identifiers. */
function buildColumnOid(baseOid: string, column: string): string {
  if (column.includes(baseOid)) {
    return column;
  }

  return `${baseOid.endsWith(".") ? baseOid.slice(0, -1) : baseOid}.${column}`;
}
