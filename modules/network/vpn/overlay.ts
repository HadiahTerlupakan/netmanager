/** Backhaul core–hub dan peer admin di overlay VPN. */
export const VPN_BACKHAUL_CIDR = "10.99.0.0/16";
/** Alamat tunnel router, satu /32 per router. */
export const VPN_ROUTER_CIDR = "10.100.0.0/14";
/** Pesan untuk router publik yang memakai alamat overlay VPN. */
export const VPN_OVERLAY_ADDRESS_MESSAGE = "Alamat ini khusus jaringan VPN";

const IPV4_OCTETS = 4;
const OCTET_BITS = 8;
const IPV4_BITS = 32;
const MAX_OCTET = 255;

function ipv4ToNumber(ip: string): number | null {
  const parts = ip.trim().split(".");
  if (parts.length !== IPV4_OCTETS) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > MAX_OCTET) return null;
    value = value * 2 ** OCTET_BITS + octet;
  }
  return value;
}

function isInCidr(ip: number, cidr: string): boolean {
  const [base, bits] = cidr.split("/");
  const blockSize = 2 ** (IPV4_BITS - Number(bits));
  const start = ipv4ToNumber(base)!;
  return ip >= start && ip < start + blockSize;
}

/**
 * True bila `ip` berada di overlay VPN. FreeRADIUS memilih tenant menurut
 * `nasname = NAS-IP`, jadi router publik yang memakai alamat tunnel router
 * tenant lain bisa menyerobot RADIUS-nya.
 */
export function isVpnOverlayAddress(ip: string): boolean {
  const value = ipv4ToNumber(ip);
  if (value === null) return false;
  return isInCidr(value, VPN_BACKHAUL_CIDR) || isInCidr(value, VPN_ROUTER_CIDR);
}
