import { logger } from "@/lib/logger";

/**
 * Tagihan yang dibatalkan tidak lagi menjadi piutang maupun pendapatan, jadi
 * jurnalnya dibalik. Dulu jurnal tagihan batal tetap berdiri dan piutang serta
 * pendapatan di laporan lebih besar dari kenyataan.
 *
 * Pembatalan tagihan sudah tersimpan saat ini dipanggil; jurnal yang gagal
 * dibalik dilaporkan dan bisa dibalik manual dari menu Jurnal.
 */
export async function reverseJournalsOfCancelledInvoice(input: {
  invoiceId: string;
  tenantId: string | null | undefined;
  reason: string;
  reversedBy: string;
}) {
  if (!input.tenantId) return;
  try {
    // Dimuat saat dipakai agar billing tidak menarik seluruh modul akuntansi.
    const { reverseCancelledInvoiceJournals } =
      await import("@/modules/accounting");
    await reverseCancelledInvoiceJournals({
      tenantId: input.tenantId,
      invoiceId: input.invoiceId,
      reason: input.reason,
      reversedBy: input.reversedBy,
    });
  } catch (error) {
    logger.error(
      `[InvoiceCancellation] Gagal membalik jurnal invoice ${input.invoiceId}:`,
      error,
    );
  }
}
