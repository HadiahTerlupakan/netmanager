import type { RouterOSAPI } from "node-routeros-v2";
import { delay } from "./mikrotik-provisioning.connection";
import {
  buildAddressListItems,
  getAddressListArgs,
  getExpiredProfileArgs,
  getExpiredProfileSetArgs,
  getFirewallAddresses,
  type AddressListItem,
} from "./mikrotik-provisioning.firewall.helpers";

const ADDRESS_LIST_NAME = "netmanager_allow";
const EXPIRED_NETWORK = "10.127.0.0/18";
const EXPIRED_POOL_NAME = "expired-pool";
const EXPIRED_POOL_RANGE = "10.127.0.2-10.127.63.254";
const EXPIRED_PROFILE_NAME = "expired users";
const EXPIRED_POOL_COMMENT = "added by netmanager - expired users";

const FILTER_RULES = [
  {
    comment: "netmanager-input-bypass",
    addArgs: [
      "=chain=input",
      "=action=accept",
      `=src-address-list=${ADDRESS_LIST_NAME}`,
    ],
    log: "Added Firewall Filter: Input Bypass (Top Priority)",
  },
  {
    comment: "netmanager-forward-bypass",
    addArgs: [
      "=chain=forward",
      "=action=accept",
      `=dst-address-list=${ADDRESS_LIST_NAME}`,
    ],
    log: "Added Firewall Filter: Forward Bypass (Top Priority)",
  },
  {
    comment: "netmanager-drop-expired-tcp",
    addArgs: [
      "=chain=forward",
      "=action=reject",
      "=protocol=tcp",
      `=src-address=${EXPIRED_NETWORK}`,
    ],
    log: "Added Firewall Filter: Drop Expired TCP",
  },
  {
    comment: "netmanager-drop-expired-udp",
    addArgs: [
      "=chain=forward",
      "=action=reject",
      "=protocol=udp",
      `=src-address=${EXPIRED_NETWORK}`,
      "=dst-port=!53,5353",
    ],
    log: "Added Firewall Filter: Drop Expired UDP",
  },
] as const;

type RouterRecord = { ".id": string };
type FirewallBypassParams = {
  connection: RouterOSAPI;
  serverIp: string;
  isolirUrl?: string | null;
  logs: string[];
};

type FirewallConnection = Pick<RouterOSAPI, "write">;

function getFilterPrintArgs(comment: string) {
  return [`?comment=${comment}`];
}

function getPoolPrintArgs() {
  return [`?name=${EXPIRED_POOL_NAME}`];
}

function getPoolCreateArgs() {
  return [
    `=name=${EXPIRED_POOL_NAME}`,
    `=ranges=${EXPIRED_POOL_RANGE}`,
    `=comment=${EXPIRED_POOL_COMMENT}`,
  ];
}

function getFilterCreateArgs(
  rule: (typeof FILTER_RULES)[number],
  placeBeforeArgs: string[],
) {
  return [...rule.addArgs, ...placeBeforeArgs, `=comment=${rule.comment}`];
}

function getProfileCreateArgs() {
  return [
    `=name=${EXPIRED_PROFILE_NAME}`,
    ...getExpiredProfileSetArgs(),
    "=comment=added by netmanager",
  ];
}

function getProfileUpdateArgs(profileId: string) {
  return [`=.id=${profileId}`, ...getExpiredProfileSetArgs()];
}

async function readRecords(
  connection: FirewallConnection,
  path: string,
  args: string[],
) {
  return (await connection.write(path, args)) as RouterRecord[];
}

async function removeRecord(input: {
  connection: FirewallConnection;
  path: string;
  id: string;
  logs: string[];
  message: string;
  delayMs: number;
}) {
  await input.connection.write(input.path, [`=.id=${input.id}`]);
  await delay(input.delayMs);
  input.logs.push(input.message);
}

async function removeAddressListEntries(
  connection: RouterOSAPI,
  address: string,
  logs: string[],
) {
  const items = await readRecords(
    connection,
    "/ip/firewall/address-list/print",
    getAddressListArgs(address),
  );

  for (const item of items) {
    await removeRecord({
      connection,
      path: "/ip/firewall/address-list/remove",
      id: item[".id"],
      logs,
      message: `Removed Firewall Address List: ${address}`,
      delayMs: 100,
    });
  }
}

async function removeFilterRules(connection: RouterOSAPI, logs: string[]) {
  for (const rule of FILTER_RULES) {
    const rules = await readRecords(
      connection,
      "/ip/firewall/filter/print",
      getFilterPrintArgs(rule.comment),
    );

    for (const foundRule of rules) {
      await removeRecord({
        connection,
        path: "/ip/firewall/filter/remove",
        id: foundRule[".id"],
        logs,
        message: `Removed Firewall Filter: ${rule.comment}`,
        delayMs: 100,
      });
    }
  }
}

async function removeExpiredProfiles(connection: RouterOSAPI, logs: string[]) {
  const expiredProfiles = await readRecords(
    connection,
    "/ppp/profile/print",
    getExpiredProfileArgs(),
  );

  for (const profile of expiredProfiles) {
    await removeRecord({
      connection,
      path: "/ppp/profile/remove",
      id: profile[".id"],
      logs,
      message: `Removed PPP Profile: ${EXPIRED_PROFILE_NAME}`,
      delayMs: 200,
    });
  }
}

async function removeFirewallAddresses(params: FirewallBypassParams) {
  for (const address of getFirewallAddresses(
    params.serverIp,
    params.isolirUrl,
  )) {
    await removeAddressListEntries(params.connection, address, params.logs);
  }
}

/** Hapus bypass firewall dan profile isolir yang dibuat provisioning. */
export async function removeFirewallBypass(params: FirewallBypassParams) {
  await removeFirewallAddresses(params);
  await removeFilterRules(params.connection, params.logs);
  await removeExpiredProfiles(params.connection, params.logs);
}

/** Pastikan bypass firewall dan profile isolir tersedia di router. */
export async function provisionFirewallBypass(params: FirewallBypassParams) {
  const items = buildAddressListItems(params.serverIp, params.isolirUrl);
  await ensureAddressList(params.connection, items, params.logs);
  await ensureFilterRules(params.connection, params.logs);
  await ensureExpiredPool(params.connection, params.logs);
  await ensureExpiredProfile(params.connection, params.logs);
}

async function ensureAddressList(
  connection: RouterOSAPI,
  items: AddressListItem[],
  logs: string[],
) {
  for (const item of items) {
    const existingList = await readRecords(
      connection,
      "/ip/firewall/address-list/print",
      getAddressListArgs(item.address),
    );
    if (existingList.length > 0) {
      continue;
    }

    await connection.write("/ip/firewall/address-list/add", [
      `=list=${ADDRESS_LIST_NAME}`,
      `=address=${item.address}`,
      `=comment=${item.comment}`,
    ]);
    await delay(200);
    logs.push(`Added Firewall Address List: ${item.address}`);
  }
}

async function hasExistingFilterRule(connection: RouterOSAPI, comment: string) {
  const rules = await readRecords(
    connection,
    "/ip/firewall/filter/print",
    getFilterPrintArgs(comment),
  );
  return rules.length > 0;
}

async function addFilterRule(
  connection: RouterOSAPI,
  rule: (typeof FILTER_RULES)[number],
  placeBeforeArgs: string[],
  logs: string[],
) {
  await connection.write(
    "/ip/firewall/filter/add",
    getFilterCreateArgs(rule, placeBeforeArgs),
  );
  await delay(200);
  logs.push(rule.log);
}

async function ensureFilterRules(connection: RouterOSAPI, logs: string[]) {
  const placeBeforeArgs = await resolvePlaceBeforeArgs(connection);

  for (const rule of FILTER_RULES) {
    if (!(await hasExistingFilterRule(connection, rule.comment))) {
      await addFilterRule(connection, rule, placeBeforeArgs, logs);
    }
  }
}

async function resolvePlaceBeforeArgs(connection: RouterOSAPI) {
  try {
    const firstRule = await readRecords(
      connection,
      "/ip/firewall/filter/print",
      ["=.proplist=.id", "=.limit=1"],
    );
    const firstRuleId = firstRule[0]?.[".id"];
    return firstRuleId ? [`=place-before=${firstRuleId}`] : [];
  } catch {
    return [];
  }
}

async function ensureExpiredPool(connection: RouterOSAPI, logs: string[]) {
  const expiredPool = await readRecords(
    connection,
    "/ip/pool/print",
    getPoolPrintArgs(),
  );

  if (expiredPool.length > 0) {
    return;
  }

  await connection.write("/ip/pool/add", getPoolCreateArgs());
  await delay(200);
  logs.push(`Added IP Pool: ${EXPIRED_POOL_NAME} (${EXPIRED_POOL_RANGE})`);
}

async function addExpiredProfile(connection: RouterOSAPI, logs: string[]) {
  await connection.write("/ppp/profile/add", getProfileCreateArgs());
  await delay(200);
  logs.push(`Added PPP Profile: ${EXPIRED_PROFILE_NAME}`);
}

async function updateExpiredProfile(
  connection: RouterOSAPI,
  profileId: string,
  logs: string[],
) {
  await connection.write("/ppp/profile/set", getProfileUpdateArgs(profileId));
  await delay(200);
  logs.push(`Updated PPP Profile: ${EXPIRED_PROFILE_NAME}`);
}

async function ensureExpiredProfile(connection: RouterOSAPI, logs: string[]) {
  const profiles = await readRecords(
    connection,
    "/ppp/profile/print",
    getExpiredProfileArgs(),
  );

  if (profiles.length === 0) {
    await addExpiredProfile(connection, logs);
    return;
  }

  await updateExpiredProfile(connection, profiles[0][".id"], logs);
}
