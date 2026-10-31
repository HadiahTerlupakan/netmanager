import type { PaymentReviewRequiredPayload } from "@/lib/event-bus";
import { logger } from "@/lib/logger";
import { BillingEventDispatcher } from "@/modules/events";

/**
 * Gateway menyatakan pembayaran yang tidak cocok dengan catatan checkout:
 * nominalnya lain, atau nomor transaksinya lain. Pembayaran itu tidak
 * dilunasi otomatis, jadi staf keuangan harus tahu. Dulu kejadian ini hanya
 * tersimpan di WebhookEvent dengan log warn dan tidak terlihat siapa pun.
 *
 * Dipakai webhook dan bisa dipakai cek status gateway untuk kasus yang sama.
 * Kegagalan mengirim pemberitahuan tidak menggagalkan pemanggilnya.
 */
export async function flagPaymentForReview(
  input: Omit<PaymentReviewRequiredPayload, "tenantId"> & {
    tenantId: string | null;
  },
) {
  logger.error(
    `[Pembayaran] ${input.reason} pada ${input.provider} ${input.orderId} (payment ${input.paymentId}): tercatat ${input.expected}, gateway ${input.received}; tidak dilunasi otomatis`,
  );
  try {
    await BillingEventDispatcher.onPaymentReviewRequired({
      ...input,
      tenantId: input.tenantId ?? undefined,
    });
  } catch (error) {
    logger.error(
      "[Pembayaran] Gagal mengirim pemberitahuan pemeriksaan pembayaran",
      error instanceof Error ? error : undefined,
    );
  }
}
