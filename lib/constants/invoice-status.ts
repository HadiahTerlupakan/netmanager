/**
 * Status invoice yang masih menyisakan kewajiban bayar bagi pelanggan.
 *
 * Dipakai bersama oleh portal pelanggan (ringkasan dashboard, daftar tagihan,
 * validasi pembayaran) supaya angka tunggakan di satu halaman tidak pernah
 * berbeda dengan halaman lain. `PARTIAL_PAID` termasuk karena sisa tagihannya
 * masih harus dibayar — sama seperti perlakuan di penjadwal isolasi otomatis.
 *
 * Catatan: ini bukan daftar universal. `InvoiceOverdueSchedulerService` sengaja
 * memakai daftar berbeda (tanpa `OVERDUE`) karena tugasnya justru menandai
 * invoice menjadi `OVERDUE`.
 */
export const OUTSTANDING_INVOICE_STATUSES = [
  "SENT",
  "OVERDUE",
  "PARTIAL_PAID",
] as const;

export type OutstandingInvoiceStatus =
  (typeof OUTSTANDING_INVOICE_STATUSES)[number];

/** Cek apakah sebuah status invoice masih menyisakan tagihan. */
export function isOutstandingInvoiceStatus(status: string): boolean {
  return (OUTSTANDING_INVOICE_STATUSES as readonly string[]).includes(status);
}
