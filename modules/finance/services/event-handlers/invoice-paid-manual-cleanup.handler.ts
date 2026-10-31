import type { Job } from "bullmq";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { logger } from "@/lib/logger";
import {
  cancelAbandonedTransferCheckout,
  findAbandonedTransferCheckouts,
} from "../../repositories/abandonedManualTransfer.repository";

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
  const checkouts = await findAbandonedTransferCheckouts(invoiceId);
  if (checkouts.length === 0) return;

  const { releaseCheckoutCoupons } = await import("@/modules/payment-gateway");
  let closed = 0;
  for (const checkout of checkouts) {
    if (!(await cancelAbandonedTransferCheckout(checkout))) continue;
    closed += checkout.length;
    await releaseCheckoutCoupons(checkout);
  }
  logger.info(
    `[${SOURCE}] ${closed} transfer manual tanpa bukti ditutup karena invoice ${invoiceId} lunas`,
  );
}
