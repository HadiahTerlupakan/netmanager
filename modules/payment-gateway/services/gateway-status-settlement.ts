import { logger } from "@/lib/logger";
import { prismaBillingAuth } from "@/lib/prisma-billing";
import { restoreReleasedCoupons } from "./abandoned-checkout";
import { creditCheckoutOverpayment } from "./overpayment-credit";
import type { TransactionStatus } from "./provider-interface";
import {
  findCheckoutPayments,
  settleCheckoutInvoices,
  type CheckoutPayment,
} from "./webhook-checkout-settlement";
import {
  hasAmountMismatch,
  hasTransactionMismatch,
  normalizePaymentMethod,
} from "./webhook-utils";

type MarkOutcome = "MOVED" | "ALREADY_PAID" | "MISMATCH";

// Status payment checkout yang masih bisa menerima uang untuk transaksi yang
// sudah terbit: menunggu, kedaluwarsa, dan diganti metode (VA lama tetap bisa
// dibayar; kelebihannya dikreditkan ke saldo).
const SETTLEABLE_STATUSES = ["PENDING", "EXPIRED", "CANCELLED"] as const;
type SettleableStatus = (typeof SETTLEABLE_STATUSES)[number];

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
  if (checkout.length === 0) return false;

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

/**
 * Pindahkan payment checkout yang masih bisa menerima uang ke PAID, dari
 * satu potret di dalam transaksi. REFUNDED dan FAILED (tidak pernah punya
 * VA) tidak pernah dipindah maupun ikut dijumlah.
 */
function markCheckoutPaid(
  checkout: CheckoutPayment[],
  paymentId: string,
  status: TransactionStatus,
): Promise<MarkOutcome> {
  return prismaBillingAuth.$transaction(async (tx) => {
    const rows = await tx.payment.findMany({
      where: { id: { in: checkout.map((payment) => payment.id) } },
      select: {
        id: true,
        amount: true,
        gatewayStatus: true,
        transactionId: true,
      },
    });
    // Callback atau cek status ganda: semua payment yang ditagih sudah PAID.
    // Payment Rp 0 (tertutup kupon) PAID sejak dibuat, dan checkout lama bisa
    // memakainya sebagai orderId; itu tidak berarti checkout-nya lunas.
    if (
      rows.every((row) => row.amount === 0n || row.gatewayStatus === "PAID")
    ) {
      return "ALREADY_PAID";
    }

    const reference = rows.find((row) => row.id === paymentId);
    if (
      hasTransactionMismatch(
        reference?.transactionId ?? null,
        status.transactionId,
      )
    ) {
      logger.error(
        `[Checkout] Nomor transaksi gateway ${status.transactionId} berbeda dari catatan payment ${paymentId}`,
      );
      return "MISMATCH";
    }

    const settleable = rows.filter((row) =>
      SETTLEABLE_STATUSES.includes(row.gatewayStatus as SettleableStatus),
    );
    const charged = settleable.reduce((sum, row) => sum + row.amount, 0n);
    if (hasAmountMismatch(charged, status.amount)) {
      logger.error(
        `[Checkout] Gateway menyatakan lunas, tetapi nominalnya berbeda untuk payment ${paymentId}: tertagih ${charged}, gateway ${status.amount}`,
      );
      return "MISMATCH";
    }

    const paymentMethod = normalizePaymentMethod(status.paymentMethod);
    // Webhook ganda atau cek status bersamaan menunggu kunci baris di sini;
    // yang kedua tidak lagi menemukan payment yang bisa dipindah.
    const moved = await tx.payment.updateMany({
      where: {
        id: { in: settleable.map((row) => row.id) },
        gatewayStatus: { in: [...SETTLEABLE_STATUSES] },
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
