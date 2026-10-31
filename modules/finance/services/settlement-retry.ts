import { logger } from "@/lib/logger";
import {
  findInvoicesWithPaidPaymentsBetween,
  type InvoiceWithReceivedPayments,
} from "../repositories/settlementRetry.repository";
import { sumActivePayments } from "./InvoicePaymentStateService";
import { settleReceivedPayments } from "./received-payment-settlement";

/** Jendela yang sama dengan rekonsiliasi INVOICE_PAID. */
const LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000;
/** Beri waktu jalur normal menyelesaikan pelunasannya sendiri. */
const SETTLE_DELAY_MS = 15 * 60 * 1000;
/** Sisanya diulang pada putaran berikutnya (tiap 15 menit). */
const MAX_INVOICES_PER_RUN = 100;

/**
 * Ulangi pelunasan yang berhenti setelah payment-nya ditandai PAID.
 *
 * Persetujuan transfer manual, callback, dan cek status gateway menyimpan
 * PAID lebih dulu, lalu menjalankan `settleReceivedPayments`. Bila itu gagal
 * (database terputus, proses mati), tidak ada yang mengulangnya: persetujuan
 * yang diulang admin dijawab "sudah diproses", dan cek status serta penyapu
 * checkout hanya menanyakan payment yang masih menunggu. Tagihannya tertinggal
 * belum lunas walau uangnya sudah diterima.
 *
 * Pass ini mencari tagihan yang tidak dibatalkan dengan payment PAID dalam
 * tiga hari terakhir (minus jeda 15 menit) yang nominal terbayarnya di bawah
 * payment yang sudah diterima beserta potongan kuponnya, lalu menjalankan
 * pelunasan yang sama. Idempoten: INVOICE_PAID hanya dikirim oleh yang
 * memenangkan peralihan ke PAID, dan kelebihan bayar ditandai di payment-nya
 * sehingga tidak dikreditkan dua kali.
 *
 * @returns jumlah tagihan yang pelunasannya berhasil diulang.
 */
export async function retryInterruptedSettlements(
  now = new Date(),
): Promise<number> {
  const from = new Date(now.getTime() - LOOKBACK_MS);
  const to = new Date(now.getTime() - SETTLE_DELAY_MS);
  const behind = (await findInvoicesWithPaidPaymentsBetween(from, to))
    .filter((invoice) => invoice.paidAmount < sumActivePayments(invoice))
    .slice(0, MAX_INVOICES_PER_RUN);

  let settled = 0;
  for (const invoice of behind) {
    if (await resettle(invoice, { from, to })) settled += 1;
  }
  return settled;
}

async function resettle(
  invoice: InvoiceWithReceivedPayments,
  window: { from: Date; to: Date },
): Promise<boolean> {
  logger.error(
    `[Pelunasan] Invoice ${invoice.id} tercatat terbayar ${invoice.paidAmount}, padahal yang diterima ${sumActivePayments(invoice)}; pelunasannya diulang`,
  );
  // Kelebihan bayar dikreditkan ke payment pertama yang dilewati: yang
  // terbaru, karena dialah yang melampaui tagihan. Payment di luar jendela
  // sudah dilunasi saat diterima.
  const interrupted = invoice.payment
    .filter(
      (payment) =>
        payment.gatewayStatus === "PAID" &&
        payment.paymentDate >= window.from &&
        payment.paymentDate <= window.to,
    )
    .sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime());
  try {
    await settleReceivedPayments(interrupted);
    return true;
  } catch (error) {
    logger.error(
      `[Pelunasan] Pelunasan ulang invoice ${invoice.id} gagal; diulang pada putaran berikutnya`,
      error instanceof Error ? error : undefined,
    );
    return false;
  }
}
