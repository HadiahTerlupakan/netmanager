import type { Job } from "bullmq";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { logger } from "@/lib/logger";
import { closeAbandonedManualTransfers } from "../abandoned-manual-transfer";

const SOURCE = "InvoicePaidManualPaymentCleanup";

/**
 * INVOICE_PAID dari jalur mana pun (gateway, transfer, kasir, saldo):
 * pilihan "Transfer Manual" untuk tagihan itu yang belum membawa bukti
 * ditutup beserta seluruh checkout-nya dan kuponnya dikembalikan, supaya
 * pelanggan tidak mentransfer nominal tagihan yang sudah lunas. Yang sudah
 * membawa bukti tetap di antrean verifikasi admin, ditandai bahwa tagihannya
 * sudah lunas; menyetujuinya mengkreditkan uangnya ke saldo.
 */
export async function handleInvoicePaidManualPaymentCleanup(
  job: Job<EventJobData>,
): Promise<void> {
  const invoiceId = requirePayloadString(
    job.data.payload.invoiceId,
    "invoiceId",
    SOURCE,
  );
  const closed = await closeAbandonedManualTransfers(invoiceId);
  if (closed === 0) return;
  logger.info(
    `[${SOURCE}] ${closed} transfer manual tanpa bukti ditutup karena invoice ${invoiceId} lunas`,
  );
}
