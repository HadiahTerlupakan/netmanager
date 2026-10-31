import { logger } from "@/lib/logger";
import { prismaBillingAuth } from "@/lib/prisma-billing";
import { restoreReleasedCoupons } from "./abandoned-checkout";
import { creditCheckoutOverpayment } from "./overpayment-credit";
import type { TransactionStatus } from "./provider-interface";
import {
  findCheckoutPayments,
  settleCheckoutInvoices,
  sumCheckoutAmount,
  type CheckoutPayment,
} from "./webhook-checkout-settlement";
import {
  hasAmountMismatch,
  hasTransactionMismatch,
  normalizePaymentMethod,
} from "./webhook-utils";

type MarkOutcome = "MOVED" | "ALREADY_PAID" | "MISMATCH";

/**
 * Lunasi checkout yang dinyatakan PAID oleh cek status gateway karena
 * callback-nya tidak pernah sampai (deploy, retry gateway habis).
 *
 * Langkahnya sama dengan webhook (WebhookProcessingService langkah 8, 10–12):
 * nominal dan nomor transaksi dicocokkan, payment satu checkout dipindah ke
 * PAID dalam satu transaksi yang hanya berhasil sekali, lalu biaya, kupon,
 * invoice, dan kelebihan bayar dibereskan oleh helper yang sama. Callback
 * yang datang belakangan menemukan payment PAID dan hanya menghitung ulang.
 *
 * Mengembalikan false bila gateway dan catatan tidak cocok; checkout-nya
 * dibiarkan menunggu untuk diperiksa admin.
 */
export async function settleCheckoutPaidAtGateway(input: {
  paymentId: string;
  status: TransactionStatus;
}): Promise<boolean> {
  const checkout = await findCheckoutPayments(input.paymentId);
  const charged = sumCheckoutAmount(checkout);
  if (
    checkout.length === 0 ||
    hasAmountMismatch(charged, input.status.amount)
  ) {
    logger.error(
      `[Checkout] Gateway menyatakan lunas, tetapi nominalnya berbeda untuk payment ${input.paymentId}: tertagih ${charged}, gateway ${input.status.amount}`,
    );
    return false;
  }

  const outcome = await markCheckoutPaid(
    checkout,
    input.paymentId,
    input.status,
  );
  if (outcome === "MISMATCH") return false;

  if (outcome === "MOVED") {
    // Dicatat sebelum pelunasan, seperti webhook: jurnal penerimaan (worker
    // INVOICE_PAID) membukukan biaya ini sebagai beban.
    await saveGatewayFee(input.paymentId, input.status.fee);
    await restoreReleasedCoupons(checkout);
  }
  await settleCheckoutInvoices(checkout);
  await creditCheckoutOverpayment(checkout);
  return true;
}

function markCheckoutPaid(
  checkout: CheckoutPayment[],
  paymentId: string,
  status: TransactionStatus,
): Promise<MarkOutcome> {
  return prismaBillingAuth.$transaction(async (tx) => {
    // Payment orderId yang sudah PAID tidak berarti seluruh checkout lunas:
    // checkout lama bisa memakai payment Rp 0 (tertutup kupon, PAID sejak
    // dibuat) sebagai orderId. Payment lain yang belum PAID tetap dipindah.
    const current = await tx.payment.findUnique({
      where: { id: paymentId },
      select: { transactionId: true },
    });
    if (
      hasTransactionMismatch(
        current?.transactionId ?? null,
        status.transactionId,
      )
    ) {
      logger.error(
        `[Checkout] Nomor transaksi gateway ${status.transactionId} berbeda dari catatan payment ${paymentId}`,
      );
      return "MISMATCH";
    }

    const paymentMethod = normalizePaymentMethod(status.paymentMethod);
    // Webhook ganda atau cek status bersamaan menunggu kunci baris di sini;
    // yang kedua tidak lagi menemukan baris non-PAID.
    const moved = await tx.payment.updateMany({
      where: {
        id: { in: checkout.map((payment) => payment.id) },
        gatewayStatus: { not: "PAID" },
      },
      data: {
        gatewayStatus: "PAID",
        // Saat lunasnya diketahui, sama seperti callback.
        paymentDate: new Date(),
        ...(paymentMethod ? { paymentMethod } : {}),
      },
    });
    if (status.transactionId) {
      await tx.payment.update({
        where: { id: paymentId },
        data: { transactionId: status.transactionId },
      });
    }
    return moved.count > 0 ? "MOVED" : "ALREADY_PAID";
  });
}

// Biaya yang gagal dicatat tidak boleh menahan pelunasan, sama seperti
// recordGatewayFee di jalur webhook.
async function saveGatewayFee(paymentId: string, fee: number | undefined) {
  if (fee === undefined || !Number.isFinite(fee)) return;
  try {
    await prismaBillingAuth.payment.update({
      where: { id: paymentId },
      data: { gatewayFee: BigInt(Math.round(fee)) },
    });
  } catch (error) {
    logger.warn("[Checkout] Gagal mencatat biaya gateway:", error);
  }
}
