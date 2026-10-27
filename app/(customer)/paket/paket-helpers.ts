/** Jenis alamat IP pelanggan seperti yang ditampilkan di portal. */
export type IpAddressKind = "Privat" | "Publik";

interface UpgradeCandidate {
  nama: string;
  priceDifference: number;
}

const IPV4_OCTET_COUNT = 4;
const MAX_OCTET = 255;

/**
 * Rentang yang tidak bisa dijangkau dari internet: RFC 1918 dan CGNAT
 * (RFC 6598, 100.64.0.0/10) yang banyak dipakai pool PPPoE ISP.
 */
const PRIVATE_IPV4_RANGES: Array<{ base: [number, number]; prefix: number }> = [
  { base: [10, 0], prefix: 8 },
  { base: [172, 16], prefix: 12 },
  { base: [192, 168], prefix: 16 },
  { base: [100, 64], prefix: 10 },
];

/** Parse IPv4 jadi bilangan 32-bit; null bila bukan IPv4 yang sah. */
function parseIpv4(ip: string): number | null {
  const octets = ip.split(".");
  if (octets.length !== IPV4_OCTET_COUNT) return null;
  let value = 0;
  for (const octet of octets) {
    if (!/^\d{1,3}$/.test(octet) || Number(octet) > MAX_OCTET) return null;
    value = value * 256 + Number(octet);
  }
  return value;
}

/** Golongkan IPv4 sebagai Privat (RFC 1918/CGNAT) atau Publik. */
export function classifyIpAddress(ip: string): IpAddressKind | null {
  const value = parseIpv4(ip);
  if (value === null) return null;
  const isPrivate = PRIVATE_IPV4_RANGES.some(({ base, prefix }) => {
    const baseValue = base[0] * 2 ** 24 + base[1] * 2 ** 16;
    const blockSize = 2 ** (32 - prefix);
    return value >= baseValue && value < baseValue + blockSize;
  });
  return isPrivate ? "Privat" : "Publik";
}

/**
 * Mundur satu bulan, kebalikan addSafeMonth di modules/finance: tanggal yang
 * tidak ada di bulan sebelumnya (31 Mar) jatuh ke hari terakhir bulan itu.
 */
function subtractSafeMonth(date: Date) {
  const previous = new Date(date);
  const day = previous.getDate();
  previous.setMonth(previous.getMonth() - 1);
  if (previous.getDate() !== day) previous.setDate(0);
  return previous;
}

/**
 * Periode tagihan yang berakhir di jatuh tempo. Billing selalu memajukan jatuh
 * tempo satu bulan kalender (addSafeMonth), jadi awal periode adalah jatuh
 * tempo mundur sebulan, kecuali pelanggan baru aktif setelah tanggal itu.
 */
export function formatBillingPeriod(jatuhTempo: string, tanggalAktif?: string) {
  if (!jatuhTempo) return "-";
  const due = new Date(jatuhTempo);
  const monthBefore = subtractSafeMonth(due);
  const activated = tanggalAktif ? new Date(tanggalAktif) : null;
  const start = activated && activated > monthBefore ? activated : monthBefore;
  const isSameYear = start.getFullYear() === due.getFullYear();

  const startLabel = start.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    ...(isSameYear ? {} : { year: "numeric" }),
  });
  const dueLabel = due.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${startLabel} - ${dueLabel}`;
}

/** Kandidat upgrade dengan tambahan biaya terkecil, atau null bila tidak ada. */
export function findCheapestUpgrade<T extends UpgradeCandidate>(
  options: T[],
): T | null {
  return options.reduce<T | null>(
    (cheapest, option) =>
      !cheapest || option.priceDifference < cheapest.priceDifference
        ? option
        : cheapest,
    null,
  );
}
