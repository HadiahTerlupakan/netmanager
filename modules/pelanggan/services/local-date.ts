/**
 * Membaca tanggal form `YYYY-MM-DD` sebagai tengah malam waktu server.
 *
 * Jalur buat dan edit pelanggan harus memakai fungsi yang sama: `new Date`
 * atas string itu menghasilkan tengah malam UTC, sehingga di server WIB
 * jatuh tempo bergeser sehari setiap kali form edit disimpan.
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}
