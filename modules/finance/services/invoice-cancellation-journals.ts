import { logger } from "@/lib/logger";
import { prismaBilling } from "@/modules/database";

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
  /** Diambil dari invoice bila tidak diberikan. */
  tenantId?: string | null;
  reason: string;
  reversedBy: string;
}) {
  const tenantId =
    input.tenantId === undefined
      ? (
          await prismaBilling.invoice.findUnique({
            where: { id: input.invoiceId },
            select: { tenantId: true },
          })
        )?.tenantId
      : input.tenantId;
  if (!tenantId) return;
  try {
    // Dimuat saat dipakai agar billing tidak menarik seluruh modul akuntansi.
    const { reverseCancelledInvoiceJournals } =
      await import("@/modules/accounting");
    await reverseCancelledInvoiceJournals({
      tenantId,
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
