import { promises as dns } from "node:dns";
import { isIP } from "node:net";
import { logger } from "@/lib/logger";
import { VpnRouterInvalidError } from "../vpn/errors";
import {
  isVpnOverlayAddress,
  VPN_OVERLAY_ADDRESS_MESSAGE,
} from "../vpn/overlay";

/** Pesan untuk nama host yang tidak bisa di-resolve saat diperiksa. */
export const UNVERIFIABLE_ROUTER_ADDRESS_MESSAGE =
  "Alamat router tidak dapat diverifikasi";
/** Pesan untuk bentuk IPv4 non-kanonik (nol di depan, oktal, heksa, kurang dari 4 bagian). */
export const INVALID_ROUTER_ADDRESS_MESSAGE = "Alamat router tidak valid";

const IPV4 = 4;
const IPV6 = 6;
const HEX_RADIX = 16;
const BYTE_BITS = 8;
const BYTE_MASK = 0xff;
// Semua label berupa angka (desimal/oktal/heksa): inet_aton menerimanya
// sebagai IPv4, padahal net.isIP menolaknya. Nama host tidak pernah punya TLD
// numerik, jadi bentuk ini selalu dianggap literal IPv4 yang tidak valid.
const NUMERIC_LABELS = /^(0x[0-9a-f]*|\d+)(\.(0x[0-9a-f]*|\d+))*\.?$/i;
const MAPPED_IPV4_DOTTED = /^::ffff:(\d{1,3}(\.\d{1,3}){3})$/;
const MAPPED_IPV4_HEX = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/;

function hexPairToIpv4(high: string, low: string): string {
  const h = Number.parseInt(high, HEX_RADIX);
  const l = Number.parseInt(low, HEX_RADIX);
  return [h >> BYTE_BITS, h & BYTE_MASK, l >> BYTE_BITS, l & BYTE_MASK].join(
    ".",
  );
}

/** IPv6 dikanonikkan; IPv4-mapped IPv6 menjadi IPv4 dotted quad. */
function normaliseIp(ip: string): string {
  if (isIP(ip) !== IPV6) return ip;
  const canonical = new URL(`http://[${ip}]`).hostname.slice(1, -1);
  const dotted = MAPPED_IPV4_DOTTED.exec(canonical);
  if (dotted) return dotted[1];
  const hex = MAPPED_IPV4_HEX.exec(canonical);
  return hex ? hexPairToIpv4(hex[1], hex[2]) : canonical;
}

function assertOutsideOverlay(ip: string): void {
  if (isVpnOverlayAddress(normaliseIp(ip))) {
    throw new VpnRouterInvalidError(VPN_OVERLAY_ADDRESS_MESSAGE);
  }
}

async function resolveAll(host: string): Promise<string[]> {
  try {
    const records = await dns.lookup(host, { all: true });
    return records.map((r) => r.address);
  } catch (error) {
    logger.warn(`[VPN] Resolve alamat router ${host} gagal:`, error);
    return [];
  }
}

/**
 * Alamat literal IPv4 kanonik dari `host` setelah normalisasi IPv4-mapped
 * IPv6, atau null bila `host` bukan literal IP. Melempar untuk bentuk IPv4
 * non-kanonik.
 */
export function literalIp(host: string): string | null {
  const trimmed = host.trim();
  if (isIP(trimmed) === IPV4 || isIP(trimmed) === IPV6) {
    return normaliseIp(trimmed);
  }
  if (NUMERIC_LABELS.test(trimmed)) {
    throw new VpnRouterInvalidError(INVALID_ROUTER_ADDRESS_MESSAGE);
  }
  return null;
}

/**
 * Menolak (fail closed) alamat router publik yang menunjuk ke overlay VPN:
 * literal IP diperiksa langsung, nama host di-resolve dan ditolak bila SALAH
 * SATU alamatnya di overlay atau bila tidak bisa di-resolve. FreeRADIUS
 * memilih tenant menurut nasname, dan koneksi API ke overlay bisa menyentuh
 * router tenant lain. Mengembalikan alamat IP yang sudah diperiksa (literal
 * yang dinormalkan, atau alamat resolve pertama); pemanggil yang langsung
 * terhubung harus memakai alamat ini, bukan nama host, agar resolve kedua
 * (DNS rebinding) tidak bisa mengarah ke overlay.
 */
export async function assertNotVpnOverlayTarget(host: string): Promise<string> {
  const ip = literalIp(host);
  if (ip !== null) {
    assertOutsideOverlay(ip);
    return ip;
  }
  const addresses = await resolveAll(host.trim());
  if (addresses.length === 0) {
    throw new VpnRouterInvalidError(UNVERIFIABLE_ROUTER_ADDRESS_MESSAGE);
  }
  addresses.forEach(assertOutsideOverlay);
  return normaliseIp(addresses[0]);
}
