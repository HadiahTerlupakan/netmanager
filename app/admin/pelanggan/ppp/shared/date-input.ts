/**
 * Nilai `<input type="date">` dalam zona waktu browser.
 *
 * `toISOString()` memakai UTC, jadi tanggal yang disimpan sebagai tengah
 * malam WIB tampil sehari lebih awal dan ikut tersimpan mundur sehari.
 */
export function toDateInputValue(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
