import type { RouterOSAPI } from "node-routeros-v2";
import { getCustomerPortalHost } from "@/lib/utils/portal-url";
import type { IsolirProvisioning } from "../isolir/isolir-provisioning";
import { delay } from "./mikrotik-provisioning.connection";
import {
  buildAddressListItems,
  type AddressListItem,
} from "./mikrotik-provisioning.firewall.helpers";
import { restoreRows, type RouterRow } from "./mikrotik-provisioning.restore";

/**
 * Tujuan yang boleh dibuka pelanggan isolir (walled garden). Terpisah dari
 * netmanager_allow karena list itu juga sumber rule input-bypass, yaitu akses
 * manajemen router penuh; list ini hanya dipakai rule bersumber 10.127.0.0/18
 * dan tidak pernah di chain input.
 */
export const ISOLIR_ALLOW_LIST = "netmanager_isolir_allow";

const ADDRESS_LIST_PATH = "/ip/firewall/address-list";
// Penanda entri tulisan provisioning; entri operator berkomentar lain
// (mis. situs pembayaran tambahan) dibiarkan.
const OWNED_COMMENT_PREFIX = "accept.";

type AllowConnection = Pick<RouterOSAPI, "write">;

function toItem(address: string): AddressListItem {
  return { address, comment: `${OWNED_COMMENT_PREFIX}${address}` };
}

/**
 * Entri walled garden: semua yang dibutuhkan pelanggan isolir dari
 * netmanager_allow (server billing, host atau layanan isolir) ditambah portal
 * pelanggan. Portal ditulis sebagai nama host supaya RouterOS me-resolve-nya
 * sendiri dan pergantian IP portal tidak butuh provisioning ulang.
 */
export function buildIsolirAllowItems(
  serverIp: string,
  isolir: IsolirProvisioning | null,
): AddressListItem[] {
  return [
    ...buildAddressListItems(serverIp, isolir),
    toItem(getCustomerPortalHost()),
  ];
}

async function readEntries(connection: AllowConnection, args: string[]) {
  return (await connection.write(`${ADDRESS_LIST_PATH}/print`, [
    `?list=${ISOLIR_ALLOW_LIST}`,
    ...args,
  ])) as RouterRow[];
}

async function ensureEntry(
  connection: AllowConnection,
  item: AddressListItem,
  logs: string[],
) {
  const label = `Firewall Address List: ${ISOLIR_ALLOW_LIST} ${item.address}`;
  const rows = await readEntries(connection, [`?address=${item.address}`]);
  if (rows.length > 0) {
    await restoreRows({
      connection,
      path: ADDRESS_LIST_PATH,
      rows,
      args: [`=list=${ISOLIR_ALLOW_LIST}`, `=address=${item.address}`],
      logs,
      label,
    });
    return;
  }

  await connection.write(`${ADDRESS_LIST_PATH}/add`, [
    `=list=${ISOLIR_ALLOW_LIST}`,
    `=address=${item.address}`,
    `=comment=${item.comment}`,
  ]);
  await delay(100);
  logs.push(`Added ${label}`);
}

// Entri dinamis hasil resolve nama host ditolak RouterOS bila dihapus
// langsung dan hilang bersama entri nama host-nya.
async function removeEntries(
  connection: AllowConnection,
  shouldRemove: (row: RouterRow) => boolean,
  logs: string[],
) {
  for (const row of await readEntries(connection, [])) {
    if (row.dynamic === "true" || !shouldRemove(row)) continue;
    await connection.write(`${ADDRESS_LIST_PATH}/remove`, [
      `=.id=${row[".id"]}`,
    ]);
    await delay(100);
    logs.push(
      `Removed Firewall Address List: ${ISOLIR_ALLOW_LIST} ${row.address}`,
    );
  }
}

/**
 * Pasang walled garden pelanggan isolir. Entri milik provisioning yang tidak
 * lagi dibutuhkan (host isolir mode lama) dibuang, kecuali `isolir = null`:
 * mode yang benar tidak diketahui, jadi entri mode dibiarkan apa adanya.
 */
export async function provisionIsolirAllowList(params: {
  connection: AllowConnection;
  serverIp: string;
  isolir: IsolirProvisioning | null;
  logs: string[];
}) {
  const items = buildIsolirAllowItems(params.serverIp, params.isolir);
  for (const item of items) {
    await ensureEntry(params.connection, item, params.logs);
  }
  if (!params.isolir) return;

  const keep = items.map((item) => item.address);
  await removeEntries(
    params.connection,
    (row) =>
      (row.comment ?? "").startsWith(OWNED_COMMENT_PREFIX) &&
      !keep.includes(row.address ?? ""),
    params.logs,
  );
}

/** Hapus seluruh entri statis walled garden saat router dilepas dari billing. */
export async function removeIsolirAllowList(
  connection: AllowConnection,
  logs: string[],
) {
  await removeEntries(connection, () => true, logs);
}

const FILTER_PATH = "/ip/firewall/filter";
const ALLOW_RULE_COMMENT = "netmanager-isolir-allow";
const FIRST_REJECT_COMMENT = "netmanager-drop-expired-tcp";

/**
 * Pindahkan rule accept walled garden ke atas rule reject isolir bila jatuh
 * di bawahnya. Provisioning lama gagal membaca rule pertama dan menambahkan
 * setiap rule di paling bawah; memulihkan argumen rule tidak mengubah
 * posisinya, jadi router itu tetap memblokir portal tanpa langkah ini.
 */
export async function ensureIsolirAllowAboveRejects(
  connection: AllowConnection,
  logs: string[],
) {
  const rows = (await connection.write(`${FILTER_PATH}/print`, [
    "=.proplist=.id,comment",
  ])) as RouterRow[];
  const allowAt = rows.findIndex((r) => r.comment === ALLOW_RULE_COMMENT);
  const rejectAt = rows.findIndex((r) => r.comment === FIRST_REJECT_COMMENT);
  if (allowAt === -1 || rejectAt === -1 || allowAt < rejectAt) return;

  await connection.write(`${FILTER_PATH}/move`, [
    `=numbers=${rows[allowAt][".id"]}`,
    `=destination=${rows[rejectAt][".id"]}`,
  ]);
  await delay(100);
  logs.push("Moved Firewall Filter: Isolir Walled Garden above reject rules");
}
