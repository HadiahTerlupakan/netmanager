/**
 * Pembacaan isian belanja di halaman daftar belanja lewat link. Murni, tanpa
 * I/O.
 */

const PRICE_PATTERN = /^\d+$/;
const PRICE_SEPARATOR_PATTERN = /[.\s]/g;
const PRICE_CURRENCY_PREFIX_PATTERN = /^rp\.?/i;
const PRICE_ZERO_CENTS_PATTERN = /,0+$/;

function padTwo(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Tanggal hari ini menurut jam perangkat, "YYYY-MM-DD". Sengaja tidak memakai
 * toISOString: sebelum pukul 07.00 WIB tanggal UTC masih kemarin.
 */
export function todayIsoDate(now: Date = new Date()): string {
  return `${now.getFullYear()}-${padTwo(now.getMonth() + 1)}-${padTwo(now.getDate())}`;
}

/**
 * Harga rupiah bulat dari teks yang diketik. Awalan "Rp" dibuang, titik dan
 * spasi dianggap pemisah ribuan ("Rp 12.000"), dan sen nol di belakang koma
 * diabaikan ("12.000,00"). null bila kosong, NaN bila tidak terbaca.
 */
export function parseRupiahInput(text: string): number | null {
  const digits = text
    .trim()
    .replace(PRICE_CURRENCY_PREFIX_PATTERN, "")
    .replace(PRICE_SEPARATOR_PATTERN, "")
    .replace(PRICE_ZERO_CENTS_PATTERN, "");
  if (digits === "") return null;
  if (!PRICE_PATTERN.test(digits)) return Number.NaN;
  return Number(digits);
}
