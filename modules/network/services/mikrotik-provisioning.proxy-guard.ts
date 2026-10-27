import type { RouterOSAPI } from "node-routeros-v2";
import { delay } from "./mikrotik-provisioning.connection";
import { restoreRows, type RouterRow } from "./mikrotik-provisioning.restore";

const EXPIRED_NETWORK = "10.127.0.0/18";

export const PROXY_GUARD_COMMENT = "netmanager-proxy-guard";

// Web proxy dinyalakan di setiap router dan port 8181 terbuka dari WAN,
// jadi tanpa rule ini router menjadi open proxy. Trafik isolir yang
// di-redirect NAT masuk ke input dari 10.127.0.0/18 dan tidak terkena.
const PROXY_GUARD_ARGS = [
  "=chain=input",
  "=action=drop",
  "=protocol=tcp",
  "=dst-port=8181",
  `=src-address=!${EXPIRED_NETWORK}`,
];

type GuardConnection = Pick<RouterOSAPI, "write">;

async function readGuardRules(connection: GuardConnection) {
  return (await connection.write("/ip/firewall/filter/print", [
    `?comment=${PROXY_GUARD_COMMENT}`,
  ])) as RouterRow[];
}

/** Argumen place-before agar rule baru berada di atas rule pertama chain. */
export async function resolvePlaceBeforeArgs(connection: GuardConnection) {
  try {
    const firstRule = (await connection.write("/ip/firewall/filter/print", [
      "=.proplist=.id",
    ])) as RouterRow[];
    const firstRuleId = firstRule[0]?.[".id"];
    return firstRuleId ? [`=place-before=${firstRuleId}`] : [];
  } catch {
    return [];
  }
}

/** Pasang guard port 8181 bila belum ada; pulihkan bila diubah atau dimatikan. */
export async function ensureProxyGuard(
  connection: GuardConnection,
  logs: string[],
  placeBeforeArgs?: string[],
) {
  const existing = await readGuardRules(connection);
  if (existing.length > 0) {
    await restoreRows({
      connection,
      path: "/ip/firewall/filter",
      rows: existing,
      args: PROXY_GUARD_ARGS,
      logs,
      label: `Firewall Filter: ${PROXY_GUARD_COMMENT}`,
    });
    return;
  }

  await connection.write("/ip/firewall/filter/add", [
    ...PROXY_GUARD_ARGS,
    ...(placeBeforeArgs ?? (await resolvePlaceBeforeArgs(connection))),
    `=comment=${PROXY_GUARD_COMMENT}`,
  ]);
  await delay(200);
  logs.push("Added Firewall Filter: Web Proxy Guard");
}

/** Hapus guard port 8181. Panggil hanya setelah web proxy terbukti mati. */
export async function removeProxyGuard(
  connection: GuardConnection,
  logs: string[],
) {
  for (const rule of await readGuardRules(connection)) {
    await connection.write("/ip/firewall/filter/remove", [
      `=.id=${rule[".id"]}`,
    ]);
    await delay(100);
    logs.push(`Removed Firewall Filter: ${PROXY_GUARD_COMMENT}`);
  }
}
