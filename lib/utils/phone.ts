/**
 * Phone Number Utilities
 * Normalisasi dan format nomor telepon Indonesia
 */

const INDONESIA_COUNTRY_CODE = "62";
const LOCAL_PREFIX = "0";

/**
 * Normalisasi nomor telepon Indonesia ke format 628xxxxxxxxx
 * - Menghapus semua karakter non-angka
 * - Mengkonversi 0xxx → 62xxx
 * - Mengkonversi +62xxx → 62xxx
 *
 * @example
 * normalizePhone("08123456789") → "628123456789"
 * normalizePhone("+628123456789") → "628123456789"
 * normalizePhone("628123456789") → "628123456789"
 * normalizePhone("0812-3456-7890") → "6281234567890"
 */
export function normalizePhone(phone: string): string {
  // Hapus semua karakter non-angka
  const digits = phone.replace(/\D/g, "");

  // Jika diawali 0, ganti dengan kode negara
  if (digits.startsWith(LOCAL_PREFIX)) {
    return `${INDONESIA_COUNTRY_CODE}${digits.slice(1)}`;
  }

  // Jika sudah diawali 62, kembalikan apa adanya
  return digits;
}

/**
 * Format nomor telepon untuk tampilan UI
 * Mengkonversi format 628xxxxxxxxx → +62 8xx-xxxx-xxxx
 *
 * @example
 * formatPhoneDisplay("628123456789") → "+62 812-3456-789"
 * formatPhoneDisplay("6281234567890") → "+62 812-345-67890"
 * formatPhoneDisplay("") → "-"
 * formatPhoneDisplay(null) → "-"
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return "-";

  const digits = normalizePhone(phone);

  // Pastikan format 628xxx
  if (!digits.startsWith(INDONESIA_COUNTRY_CODE) || digits.length < 10) {
    return phone; // Kembalikan apa adanya jika tidak valid
  }

  // Format: +62 8xx-xxxx-xxxx
  const localNumber = digits.slice(2); // Hapus "62"

  // Bagi menjadi 3 bagian: 3 digit pertama, 4 digit tengah, sisa
  if (localNumber.length <= 3) {
    return `+62 ${localNumber}`;
  }

  if (localNumber.length <= 7) {
    const part1 = localNumber.slice(0, 3);
    const part2 = localNumber.slice(3);
    return `+62 ${part1}-${part2}`;
  }

  const part1 = localNumber.slice(0, 3);
  const part2 = localNumber.slice(3, 7);
  const part3 = localNumber.slice(7);
  return `+62 ${part1}-${part2}-${part3}`;
}

/**
 * Validasi format nomor telepon Indonesia
 * Menerima format: 08xxx, 628xxx, +628xxx
 *
 * @returns true jika format valid
 */
export function isValidIndonesianPhone(phone: string): boolean {
  const regex = /^(\+62|62|0)[0-9]{9,12}$/;
  return regex.test(phone);
}
