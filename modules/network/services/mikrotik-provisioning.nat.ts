import type { RouterOSAPI } from "node-routeros-v2";
import type { IsolirProvisioning } from "../isolir/isolir-provisioning";
import {
  ISOLIR_SERVICE_HTTP_PORT,
  ISOLIR_SERVICE_HTTPS_PORT,
} from "../isolir/isolir-service.constants";
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
const NAT_PATH = "/ip/firewall/nat";
const MANGLE_PATH = "/ip/firewall/mangle";
const SERVICE_PORTS = `${ISOLIR_SERVICE_HTTP_PORT},${ISOLIR_SERVICE_HTTPS_PORT}`;

type NatConnection = Pick<RouterOSAPI, "write">;
type NatParams = { connection: NatConnection; logs: string[] };
type FirewallRule = {
  path: typeof NAT_PATH | typeof MANGLE_PATH;
  comment: string;
  placeFirst: boolean;
  args: readonly string[];
};

// Rule HTTP memakai satu comment di semua mode agar pindah mode cukup men-set
// ulang baris yang sama; rule milik mode lain dibuang menurut comment-nya.
const HTTP_REDIRECT = {
  path: NAT_PATH,
  comment: "netmanager-redirect-expired",
} as const;
const HTTPS_REDIRECT = {
  path: NAT_PATH,
  comment: "netmanager-redirect-expired-https",
} as const;
const ISOLIR_MASQUERADE = {
  path: NAT_PATH,
  comment: "netmanager-masquerade-isolir",
} as const;
const ISOLIR_MSS = {
  path: MANGLE_PATH,
  comment: "netmanager-isolir-mss",
} as const;
const MODE_RULES = [
  HTTP_REDIRECT,
  HTTPS_REDIRECT,
  ISOLIR_MASQUERADE,
  ISOLIR_MSS,
] as const;

// The redirect goes first so an operator's own dstnat cannot catch an
// isolated customer's web traffic before the isolir page does. The
// masquerade goes last so an operator's existing srcnat keeps priority; it
// only covers private sources leaving for non-private destinations, so
// public-IP pools, the VPN tunnel and LAN-to-LAN traffic are left alone.
const PROXY_REDIRECT_RULE: FirewallRule = {
  ...HTTP_REDIRECT,
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
};

const MASQUERADE_RULE: FirewallRule = {
  path: NAT_PATH,
  comment: "netmanager-masquerade",
  placeFirst: false,
  args: [
    "=chain=srcnat",
    "=action=masquerade",
    `=src-address-list=${PRIVATE_LIST}`,
    `=dst-address-list=!${PRIVATE_LIST}`,
  ],
};

function serviceRedirectArgs(address: string, toPort: number, port: number) {
  return [
    "=chain=dstnat",
    "=action=dst-nat",
    `=to-addresses=${address}`,
    `=to-ports=${toPort}`,
    "=protocol=tcp",
    `=src-address=${EXPIRED_NETWORK}`,
    `=dst-address-list=!${ALLOW_LIST}`,
    `=dst-port=${port}`,
  ];
}

// Pelanggan isolir dibelokkan lewat tunnel ke servis isolir di core. Source
// NAT ke IP overlay router dipasang paling atas supaya srcnat operator tidak
// mendahuluinya: core hanya bisa membalas ke alamat tunnel, bukan ke
// 10.127.0.0/18. IP itu ada di bridge netmanager-lo, bukan di interface
// WireGuard, jadi masquerade akan memakai IP publik router dan hub membuang
// paketnya; masquerade hanya dipakai bila IP tunnel tidak diketahui. MSS
// di-clamp karena MTU tunnel lebih kecil dari jalur pelanggan, sehingga paket
// TCP besar tidak hilang di tengah jalan.
function serviceRules(
  address: string,
  srcAddress: string | null | undefined,
): FirewallRule[] {
  const toService = [
    `=src-address=${EXPIRED_NETWORK}`,
    `=dst-address=${address}`,
    `=dst-port=${SERVICE_PORTS}`,
  ];
  return [
    {
      ...HTTP_REDIRECT,
      placeFirst: true,
      args: serviceRedirectArgs(address, ISOLIR_SERVICE_HTTP_PORT, 80),
    },
    {
      ...HTTPS_REDIRECT,
      placeFirst: true,
      args: serviceRedirectArgs(address, ISOLIR_SERVICE_HTTPS_PORT, 443),
    },
    {
      ...ISOLIR_MASQUERADE,
      placeFirst: true,
      args: [
        "=chain=srcnat",
        ...(srcAddress
          ? ["=action=src-nat", `=to-addresses=${srcAddress}`]
          : ["=action=masquerade"]),
        "=protocol=tcp",
        ...toService,
      ],
    },
    {
      ...ISOLIR_MSS,
      placeFirst: false,
      args: [
        "=chain=forward",
        "=action=change-mss",
        "=new-mss=clamp-to-pmtu",
        "=passthrough=yes",
        "=protocol=tcp",
        "=tcp-flags=syn",
        ...toService,
      ],
    },
  ];
}

function rulesForMode(
  isolir: IsolirProvisioning,
  srcAddress: string | null | undefined,
): FirewallRule[] {
  return isolir.mode === "ISOLIR_SERVICE"
    ? serviceRules(isolir.address, srcAddress)
    : [PROXY_REDIRECT_RULE];
}

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

async function firstRuleArgs(connection: NatConnection, path: string) {
  const rules = await readRecords(connection, `${path}/print`, [
    "=.proplist=.id",
  ]);
  const firstId = rules[0]?.[".id"];
  return firstId ? [`=place-before=${firstId}`] : [];
}

function ruleLabel(path: string, comment: string) {
  return `Firewall ${path === MANGLE_PATH ? "Mangle" : "NAT"}: ${comment}`;
}

async function ensureRule({ connection, logs }: NatParams, rule: FirewallRule) {
  const existing = await readRecords(connection, `${rule.path}/print`, [
    `?comment=${rule.comment}`,
  ]);
  if (existing.length > 0) {
    await restoreRows({
      connection,
      path: rule.path,
      rows: existing,
      args: rule.args,
      logs,
      label: ruleLabel(rule.path, rule.comment),
    });
    return;
  }

  const placement = rule.placeFirst
    ? await firstRuleArgs(connection, rule.path)
    : [];
  await connection.write(`${rule.path}/add`, [
    ...rule.args,
    ...placement,
    `=comment=${rule.comment}`,
  ]);
  await delay(200);
  logs.push(`Added ${ruleLabel(rule.path, rule.comment)}`);
}

async function removeRule(
  { connection, logs }: NatParams,
  rule: Pick<FirewallRule, "path" | "comment">,
) {
  const rows = await readRecords(connection, `${rule.path}/print`, [
    `?comment=${rule.comment}`,
  ]);
  for (const row of rows) {
    await connection.write(`${rule.path}/remove`, [`=.id=${row[".id"]}`]);
    logs.push(`Removed ${ruleLabel(rule.path, rule.comment)}`);
  }
}

/**
 * Pasang rule NAT isolir sesuai mode dan masquerade pelanggan beralamat
 * privat. `isolir = null` (konfigurasi gagal disusun) membiarkan rule bermode
 * apa adanya, karena mode yang benar tidak diketahui. `srcAddress` adalah IP
 * tunnel router VPN, alamat sumber lalu lintas pelanggan ke servis isolir.
 */
export async function provisionNatRules(
  params: NatParams & {
    isolir: IsolirProvisioning | null;
    srcAddress?: string | null;
  },
) {
  await ensurePrivateList(params);

  if (params.isolir) {
    const rules = rulesForMode(params.isolir, params.srcAddress);
    for (const rule of rules) {
      await ensureRule(params, rule);
    }
    for (const owned of MODE_RULES) {
      if (!rules.some((rule) => rule.comment === owned.comment)) {
        await removeRule(params, owned);
      }
    }
  }

  await ensureRule(params, MASQUERADE_RULE);
}

/**
 * Hapus aturan NAT, mangle, dan address list yang dipasang provisioning.
 * Rule semua mode dihapus menurut comment, apa pun mode router sekarang.
 */
export async function removeNatRules(params: NatParams) {
  const { connection, logs } = params;
  for (const rule of [...MODE_RULES, MASQUERADE_RULE]) {
    await removeRule(params, rule);
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
