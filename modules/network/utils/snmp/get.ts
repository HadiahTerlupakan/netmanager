import snmp from "net-snmp";
import { DEFAULT_SNMP_TIMEOUT } from "./constants";
import { closeSnmpSession, createSnmpSession } from "./session";

/** Read a single OID from an SNMP target. */
export async function snmpGet(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oid: string,
  timeout: number = DEFAULT_SNMP_TIMEOUT,
): Promise<string | null> {
  return new Promise((resolve) => {
    let isResolved = false;
    let session: snmp.Session | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const finish = (value: string | null) => {
      if (isResolved) return;
      isResolved = true;
      if (timeoutId) clearTimeout(timeoutId);
      closeSnmpSession(session);
      session = null;
      resolve(value);
    };

    try {
      session = createSnmpSession({
        ipAddress,
        port,
        community,
        version,
        timeout: 5_000,
      });
      session.get([oid], (error, varbinds) => {
        if (isResolved) return;
        if (error || !varbinds?.length) {
          finish(null);
          return;
        }

        const [varbind] = varbinds;
        if (!varbind || snmp.isVarbindError(varbind)) {
          finish(null);
          return;
        }

        finish(varbind.value == null ? null : String(varbind.value));
      });

      timeoutId = setTimeout(() => finish(null), timeout);
    } catch {
      finish(null);
    }
  });
}

/** Read multiple OIDs from an SNMP target concurrently. */
export async function snmpGetMultiple(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oids: string[],
  timeout: number = DEFAULT_SNMP_TIMEOUT,
): Promise<Record<string, string>> {
  if (oids.length === 0) {
    return {};
  }

  const pairs = await Promise.all(
    oids.map(
      async (oid): Promise<{ oid: string; value: string | null }> => ({
        oid,
        value: await snmpGet(
          ipAddress,
          port,
          community,
          version,
          oid,
          timeout,
        ).catch((): null => null),
      }),
    ),
  );

  return pairs.reduce<Record<string, string>>((resultMap, pair) => {
    if (pair.value !== null) {
      resultMap[pair.oid] = pair.value;
    }
    return resultMap;
  }, {});
}
