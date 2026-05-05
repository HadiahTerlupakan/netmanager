const ADDRESS_LIST_NAME = "netmanager_allow";
const EXPIRED_PROFILE_NAME = "expired users";
const EXPIRED_LOCAL_ADDRESS = "10.127.0.1";
const EXPIRED_POOL_NAME = "expired-pool";
const EXPIRED_DNS = "8.8.8.8,1.1.1.1";

export type AddressListItem = { address: string; comment: string };

function extractIsolirDomain(isolirUrl?: string | null): string | null {
  return isolirUrl?.replace(/^https?:\/\//, "").split("/")[0] || null;
}

function getSafeIsolirDomain(isolirUrl?: string | null) {
  try {
    return extractIsolirDomain(isolirUrl);
  } catch {
    return null;
  }
}

export function getFirewallAddresses(
  serverIp: string,
  isolirUrl?: string | null,
) {
  const addresses = [serverIp];
  const domain = getSafeIsolirDomain(isolirUrl);
  if (domain) {
    addresses.push(domain);
  }
  return addresses;
}

export function buildAddressListItems(
  serverIp: string,
  isolirUrl?: string | null,
): AddressListItem[] {
  const items: AddressListItem[] = [
    { address: serverIp, comment: `accept.${serverIp}` },
  ];
  const domain = getSafeIsolirDomain(isolirUrl);
  if (domain) {
    items.push({ address: domain, comment: `accept.${domain}` });
  }
  return items;
}

export function hasIsolirDomain(isolirUrl?: string | null) {
  return Boolean(getSafeIsolirDomain(isolirUrl));
}

export function getAddressListArgs(address: string) {
  return [`?list=${ADDRESS_LIST_NAME}`, `?address=${address}`];
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
