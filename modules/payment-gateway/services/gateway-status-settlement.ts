import { prismaBillingAuth } from "@/lib/prisma-billing";
import {
  FinanceRepositoryFacade,
  settleReceivedPayments,
} from "@/modules/finance";
import { restoreReleasedCoupons } from "./abandoned-checkout";
import { recordGatewayFee } from "./gateway-fee";
import { flagPaymentForReview } from "./payment-review";
import type { TransactionStatus } from "./provider-interface";
import {
  hasAmountMismatch,
  hasTransactionMismatch,
  normalizePaymentMethod,
} from "./webhook-utils";

// Status payment checkout yang masih bisa menerima uang untuk transaksi yang
// sudah terbit: menunggu, kedaluwarsa, dan diganti metode (VA lama tetap bisa
// dibayar; kelebihannya dikreditkan ke saldo).
const SETTLEABLE_STATUSES = ["PENDING", "EXPIRED", "CANCELLED"] as const;
type SettleableStatus = (typeof SETTLEABLE_STATUSES)[number];

const CHECKOUT_PAYMENT_SELECT = {
  id: true,
  amount: true,
  invoiceId: true,
  tenantId: true,
  couponUsageId: true,
  couponId: true,
  pelangganId: true,
  reference: true,
} as const;

export type CheckoutPayment = {
  id: string;
  amount: bigint;
  invoiceId: string | null;
  tenantId: string | null;
  couponUsageId: string | null;
  couponId: string | null;
  pelangganId: string;
  reference: string | null;
};

/** Pernyataan gateway bahwa orderId dibayar, dari callback atau cek status. */
export type GatewayPaidReport = Pick<
  TransactionStatus,
  "orderId" | "amount" | "transactionId" | "paymentMethod" | "paidAt" | "fee"
>;

type Mismatch = {
  outcome: "AMOUNT_MISMATCH" | "TRANSACTION_MISMATCH";
  expected: string;
  received: string;
};

export type GatewaySettlement =
  | { outcome: "SETTLED" | "ALREADY_PAID" }
  | Mismatch;

type MarkResult = { outcome: "MOVED" | "ALREADY_PAID" } | Mismatch;

/**
 * Semua payment dari satu checkout gateway. Checkout beberapa invoice membuat
 * satu payment per invoice, tetapi gateway hanya mengenal orderId satu
 * payment dan menagih totalnya. Payment lama tanpa checkoutId berdiri
 * sendiri.
 */
export async function findCheckoutPayments(
  paymentId: string,
): Promise<CheckoutPayment[]> {
  const payment = await prismaBillingAuth.payment.findUnique({
    where: { id: paymentId },
    select: { ...CHECKOUT_PAYMENT_SELECT, checkoutId: true },
  });
  if (!payment) return [];
  if (!payment.checkoutId) return [payment];

  return prismaBillingAuth.payment.findMany({
    where: { checkoutId: payment.checkoutId },
    select: CHECKOUT_PAYMENT_SELECT,
  });
}

/**
 * Satu jalur pelunasan untuk checkout yang dinyatakan PAID oleh gateway:
 * callback, cek status dari portal, dan penyapu checkout yang menemukan
 * callback yang hilang.
 *
 * Nominal dan nomor transaksi dicocokkan dengan baris checkout yang dibaca di
 * dalam transaksi, dan payment yang masih bisa menerima uang dipindah ke PAID
 * oleh transaksi yang hanya berhasil sekali. Setelah commit: biaya gateway,
 * kupon yang sempat dikembalikan, lalu pelunasan finance (tagihan yang sudah
 * dibatalkan tidak dihidupkan lagi; uangnya ke tagihan pengganti atau saldo,
 * dan kelebihan bayar menjadi saldo kredit). Pelunasan itu idempoten dan tetap
 * dijalankan untuk checkout yang sudah PAID, supaya proses yang mati setelah
 * commit dipulihkan oleh callback atau cek status berikutnya.
 *
 * Yang tidak cocok tidak dilunasi dan diteruskan ke staf keuangan.
 */
export async function settleCheckoutPaidAtGateway(input: {
  paymentId: string;
  provider: string;
  status: GatewayPaidReport;
}): Promise<GatewaySettlement> {
  const checkout = await findCheckoutPayments(input.paymentId);
  const orderPayment = checkout.find((p) => p.id === input.paymentId);
  const marked = await markCheckoutPaid(
    checkout,
    input.paymentId,
    input.status,
  );

  if (
    marked.outcome === "AMOUNT_MISMATCH" ||
    marked.outcome === "TRANSACTION_MISMATCH"
  ) {
    const mismatch = {
      paymentId: input.paymentId,
      reason: marked.outcome,
      expected: marked.expected,
      received: marked.received,
    };
    // Checkout yang tidak cocok tetap menunggu dan ditanyakan lagi oleh
    // penyapu tiap putaran; jawaban yang sama diteruskan ke staf sekali.
    if (await FinanceRepositoryFacade.claimPaymentReviewFlag(mismatch)) {
      await flagPaymentForReview({
        ...mismatch,
        provider: input.provider,
        orderId: input.status.orderId,
        tenantId: orderPayment?.tenantId ?? null,
      });
    }
    return marked;
  }

  if (marked.outcome === "MOVED") {
    // Dicatat sebelum pelunasan: jurnal penerimaan (worker INVOICE_PAID)
    // membukukan biaya ini sebagai beban.
    await recordGatewayFee(input.provider, orderPayment, input.status.fee);
    await restoreReleasedCoupons(checkout);
  }
  await settleReceivedPayments(checkout);
  return { outcome: marked.outcome === "MOVED" ? "SETTLED" : "ALREADY_PAID" };
}

/**
 * Pindahkan payment checkout yang masih bisa menerima uang ke PAID, dari
 * satu potret di dalam transaksi. REFUNDED dan FAILED tidak pernah dipindah
 * maupun ikut dijumlah.
 */
function markCheckoutPaid(
  checkout: CheckoutPayment[],
  paymentId: string,
  status: GatewayPaidReport,
): Promise<MarkResult> {
  return prismaBillingAuth.$transaction(async (tx): Promise<MarkResult> => {
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
      return { outcome: "ALREADY_PAID" };
    }

    const recorded = rows.find((row) => row.id === paymentId)?.transactionId;
    if (hasTransactionMismatch(recorded ?? null, status.transactionId)) {
      return {
        outcome: "TRANSACTION_MISMATCH",
        expected: recorded,
        received: status.transactionId,
      };
    }

    const settleable = rows.filter((row) =>
      SETTLEABLE_STATUSES.includes(row.gatewayStatus as SettleableStatus),
    );
    const charged = settleable.reduce((sum, row) => sum + row.amount, 0n);
    if (hasAmountMismatch(charged, status.amount)) {
      return {
        outcome: "AMOUNT_MISMATCH",
        expected: charged.toString(),
        received: String(status.amount),
      };
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
        // Duitku tidak mengirim waktu bayar; yang dipakai saat lunasnya
        // diketahui.
        paymentDate: status.paidAt ?? new Date(),
        ...(paymentMethod ? { paymentMethod } : {}),
      },
    });
    if (status.transactionId) {
      await tx.payment.update({
        where: { id: paymentId },
        data: { transactionId: status.transactionId },
      });
    }
    return { outcome: moved.count > 0 ? "MOVED" : "ALREADY_PAID" };
  });
}
