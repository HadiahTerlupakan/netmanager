import type { RouterOSAPI } from "node-routeros-v2";
import { delay } from "./mikrotik-provisioning.connection";
import { restoreRows, type RouterRow } from "./mikrotik-provisioning.restore";

const EXPIRED_NETWORK = "10.127.0.0/18";
const ALLOW_LIST = "netmanager_allow";
const PRIVATE_LIST = "netmanager_private";
const PROXY_PORT = "8181";
const PRIVATE_RANGES = [
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "100.64.0.0/10",
] as const;

type NatConnection = Pick<RouterOSAPI, "write">;
type NatParams = { connection: NatConnection; logs: string[] };

// The redirect goes first so an operator's own dstnat cannot catch an
// isolated customer's web traffic before the isolir page does. The
// masquerade goes last so an operator's existing srcnat keeps priority; it
// only covers private sources leaving for non-private destinations, so
// public-IP pools, the VPN tunnel and LAN-to-LAN traffic are left alone.
const NAT_RULES = [
  {
    comment: "netmanager-redirect-expired",
    placeFirst: true,
    args: [
      "=chain=dstnat",
      "=action=redirect",
      `=to-ports=${PROXY_PORT}`,
      "=protocol=tcp",
      `=src-address=${EXPIRED_NETWORK}`,
      `=dst-address-list=!${ALLOW_LIST}`,
      "=dst-port=80,443",
    ],
  },
  {
    comment: "netmanager-masquerade",
    placeFirst: false,
    args: [
      "=chain=srcnat",
      "=action=masquerade",
      `=src-address-list=${PRIVATE_LIST}`,
      `=dst-address-list=!${PRIVATE_LIST}`,
    ],
  },
] as const;

async function readRecords(
  connection: NatConnection,
  path: string,
  args: string[],
) {
  return (await connection.write(path, args)) as RouterRow[];
}

async function ensurePrivateList({ connection, logs }: NatParams) {
  for (const range of PRIVATE_RANGES) {
    const existing = await readRecords(
      connection,
      "/ip/firewall/address-list/print",
      [`?list=${PRIVATE_LIST}`, `?address=${range}`],
    );
    if (existing.length > 0) {
      await restoreRows({
        connection,
        path: "/ip/firewall/address-list",
        rows: existing,
        args: [`=list=${PRIVATE_LIST}`, `=address=${range}`],
        logs,
        label: `Firewall Address List: ${PRIVATE_LIST} ${range}`,
      });
      continue;
    }

    await connection.write("/ip/firewall/address-list/add", [
      `=list=${PRIVATE_LIST}`,
      `=address=${range}`,
      "=comment=added by netmanager",
    ]);
    await delay(100);
    logs.push(`Added Firewall Address List: ${PRIVATE_LIST} ${range}`);
  }
}

async function firstNatRuleArgs(connection: NatConnection) {
  const rules = await readRecords(connection, "/ip/firewall/nat/print", [
    "=.proplist=.id",
  ]);
  const firstId = rules[0]?.[".id"];
  return firstId ? [`=place-before=${firstId}`] : [];
}

/** Pasang redirect halaman isolir dan masquerade pelanggan beralamat privat. */
export async function provisionNatRules(params: NatParams) {
  await ensurePrivateList(params);

  for (const rule of NAT_RULES) {
    const existing = await readRecords(
      params.connection,
      "/ip/firewall/nat/print",
      [`?comment=${rule.comment}`],
    );
    if (existing.length > 0) {
      await restoreRows({
        connection: params.connection,
        path: "/ip/firewall/nat",
        rows: existing,
        args: rule.args,
        logs: params.logs,
        label: `Firewall NAT: ${rule.comment}`,
      });
      continue;
    }

    const placement = rule.placeFirst
      ? await firstNatRuleArgs(params.connection)
      : [];
    await params.connection.write("/ip/firewall/nat/add", [
      ...rule.args,
      ...placement,
      `=comment=${rule.comment}`,
    ]);
    await delay(200);
    params.logs.push(`Added Firewall NAT: ${rule.comment}`);
  }
}

/** Hapus aturan NAT dan address list yang dipasang provisioning. */
export async function removeNatRules({ connection, logs }: NatParams) {
  for (const rule of NAT_RULES) {
    const rules = await readRecords(connection, "/ip/firewall/nat/print", [
      `?comment=${rule.comment}`,
    ]);
    for (const found of rules) {
      await connection.write("/ip/firewall/nat/remove", [
        `=.id=${found[".id"]}`,
      ]);
      logs.push(`Removed Firewall NAT: ${rule.comment}`);
    }
  }

  const entries = await readRecords(
    connection,
    "/ip/firewall/address-list/print",
    [`?list=${PRIVATE_LIST}`],
  );
  for (const entry of entries) {
    await connection.write("/ip/firewall/address-list/remove", [
      `=.id=${entry[".id"]}`,
    ]);
  }
  if (entries.length > 0) {
    logs.push(`Removed Firewall Address List: ${PRIVATE_LIST}`);
  }
}
