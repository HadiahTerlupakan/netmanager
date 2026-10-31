import type { InvoiceStatus } from "@prisma/client-billing";

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

// Record atas enum Prisma: status baru di skema gagal dikompilasi sampai
// diberi label, jadi pelanggan tidak lagi melihat kode mentah seperti
// "CANCELLED". SENT dan OVERDUE sama bagi pelanggan: dua-duanya harus dibayar.
const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Draf",
  SENT: "Belum Bayar",
  OVERDUE: "Belum Bayar",
  PAID: "Lunas",
  PARTIAL_PAID: "Dibayar Sebagian",
  CANCELLED: "Dibatalkan",
};

/** Label status invoice untuk portal pelanggan (/tagihan dan /riwayat). */
export function getInvoiceStatusLabel(status: string): string {
  return INVOICE_STATUS_LABELS[status as InvoiceStatus] ?? status;
}
