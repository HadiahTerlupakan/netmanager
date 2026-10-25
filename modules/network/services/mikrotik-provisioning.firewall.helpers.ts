import { isIP } from "node:net";
import {
  splitIsolirTarget,
  type IsolirProvisioning,
} from "../isolir/isolir-provisioning";

const ADDRESS_LIST_NAME = "netmanager_allow";
const EXPIRED_PROFILE_NAME = "expired users";
const EXPIRED_LOCAL_ADDRESS = "10.127.0.1";
const EXPIRED_POOL_NAME = "expired-pool";
const EXPIRED_DNS = "8.8.8.8,1.1.1.1";

export type AddressListItem = { address: string; comment: string };

/**
 * Entri netmanager_allow: IP server billing, ditambah host isolir untuk mode
 * REDIRECT agar pelanggan isolir bisa membuka halaman tujuan redirect.
 */
export function buildAddressListItems(
  serverIp: string,
  isolir: IsolirProvisioning | null,
): AddressListItem[] {
  const items: AddressListItem[] = [
    { address: serverIp, comment: `accept.${serverIp}` },
  ];
  if (isolir?.mode === "REDIRECT") {
    const { host } = splitIsolirTarget(isolir.target);
    items.push({ address: host, comment: `accept.${host}` });
  }
  return items;
}

// Alamat address-list RouterOS bisa berupa IP, CIDR, rentang a-b, atau nama
// host; hanya nama host yang tidak lolos isIP di setiap bagiannya.
function isHostname(address: string) {
  return !address.split(/[/-]/).every((part) => isIP(part) !== 0);
}

/**
 * Entri host isolir REDIRECT lama yang boleh dibuang saat provisioning.
 * netmanager_allow juga dipakai rule input-bypass untuk akses manajemen dan
 * CoA, jadi entri IP (server billing lama saat migrasi VPN, IP NOC operator)
 * tidak pernah dihapus; yang dibuang hanya nama host berkomentar `accept.`
 * yang dulu ditulis provisioning dan kini bukan host isolir lagi.
 */
export function isStaleIsolirHostEntry(
  item: Record<string, string | undefined>,
  keep: readonly string[],
) {
  const address = item.address ?? "";
  return (
    isHostname(address) &&
    (item.comment ?? "").startsWith("accept.") &&
    !keep.includes(address)
  );
}

export function getAddressListArgs(address: string) {
  return [`?list=${ADDRESS_LIST_NAME}`, `?address=${address}`];
}

export function getAllowListArgs() {
  return [`?list=${ADDRESS_LIST_NAME}`];
}

export function getExpiredProfileArgs() {
  return [`?name=${EXPIRED_PROFILE_NAME}`];
}

export function getExpiredProfileSetArgs() {
  return [
    `=local-address=${EXPIRED_LOCAL_ADDRESS}`,
    `=remote-address=${EXPIRED_POOL_NAME}`,
    `=dns-server=${EXPIRED_DNS}`,
  ];
}
