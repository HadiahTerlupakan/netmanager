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
