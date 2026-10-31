import type { PaymentReviewRequiredPayload } from "@/lib/event-bus";
import { prismaBillingAuth } from "@/lib/prisma-billing";

/** Ketidakcocokan gateway yang diteruskan ke staf keuangan untuk satu payment. */
export type PaymentReviewMismatch = Pick<
  PaymentReviewRequiredPayload,
  "paymentId" | "reason" | "expected" | "received"
>;

/**
 * Catat ketidakcocokan ini di payment-nya; false bila yang sama sudah
 * tercatat, sehingga staf tidak diberi tahu dua kali untuk jawaban gateway
 * yang sama. Satu pernyataan bersyarat: callback, cek status, dan penyapu
 * yang bersamaan hanya meneruskannya sekali. Ketidakcocokan lain (mis. nominal
 * dari gateway berubah) menggantikannya dan diteruskan lagi.
 */
export async function claimPaymentReviewFlag(
  mismatch: PaymentReviewMismatch,
): Promise<boolean> {
  const flag = `${mismatch.reason}: tercatat ${mismatch.expected}, gateway ${mismatch.received}`;
  const { count } = await prismaBillingAuth.payment.updateMany({
    where: {
      id: mismatch.paymentId,
      OR: [{ reviewFlag: null }, { reviewFlag: { not: flag } }],
    },
    data: { reviewFlag: flag },
  });
  return count > 0;
}
