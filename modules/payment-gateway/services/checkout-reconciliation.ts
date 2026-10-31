import { logger } from "@/lib/logger";
import { prismaBillingAuth } from "@/lib/prisma-billing";
import { settleCheckoutPaidAtGateway } from "./gateway-status-settlement";
import { findPaymentMethodProvider } from "./payment-method-catalog";
import { PaymentGatewayManager } from "./PaymentGatewayService";
import {
  GatewayTransactionNotFoundError,
  type StatusCheckOptions,
  type TransactionStatus,
} from "./provider-interface";

export type CheckoutPaymentRef = {
  id: string;
  reference: string | null;
  gatewayProvider: string | null;
  tenantId: string | null;
};

const CHECKOUT_REF_SELECT = {
  id: true,
  reference: true,
  gatewayProvider: true,
  tenantId: true,
} as const;

export type CheckoutReconciliation =
  | { outcome: "PAID" }
  | {
      outcome: "UNPAID";
      gatewayStatus: Exclude<TransactionStatus["status"], "PAID">;
    }
  | { outcome: "UNKNOWN" };

/**
 * Payment yang reference-nya dikirim ke gateway sebagai orderId. Gateway
 * hanya mengenal satu orderId per checkout dan tidak ada kolom yang
 * mencatatnya; memilih reference terkecil membuatnya bisa ditemukan lagi
 * dari baris checkout itu sendiri.
 */
export function selectGatewayOrderPayment<
  T extends { reference?: string | null },
>(payments: T[]): T | undefined {
  return orderByReference(payments)[0];
}

function orderByReference<T extends { reference?: string | null }>(
  payments: T[],
) {
  return [...payments].sort((a, b) =>
    (a.reference ?? "").localeCompare(b.reference ?? ""),
  );
}

/**
 * Portal menyimpan kode kanal (mis. "BC") di gatewayProvider; data lama dan
 * gateway berhalaman bayar menyimpan nama gateway-nya langsung.
 */
export function gatewayProviderOf(payment: {
  gatewayProvider: string | null;
}): string | null {
  const stored = payment.gatewayProvider;
  return stored ? (findPaymentMethodProvider(stored) ?? stored) : null;
}

/**
 * Tanyakan ke gateway apakah checkout ini sudah dibayar, dan lunasi bila ya.
 *
 * Status yang tidak terbaca (gateway tidak terjangkau, jawaban tak dikenal)
 * menghasilkan UNKNOWN: pemanggil tidak boleh menutup checkout atas dasar
 * itu, karena uangnya bisa saja sudah masuk. Gateway yang menjawab tidak
 * mengenal satu pun orderId checkout ini (mis. Snap Midtrans yang ditinggalkan
 * sebelum memilih kanal) berarti tidak ada yang dibayar.
 */
export async function reconcileCheckout(
  payments: CheckoutPaymentRef[],
  options: StatusCheckOptions = {},
): Promise<CheckoutReconciliation> {
  const answer = await queryCheckoutStatus(
    await withWholeCheckouts(payments),
    options,
  );
  if (answer === "UNREADABLE") return { outcome: "UNKNOWN" };
  if (answer === "NOT_FOUND") {
    return { outcome: "UNPAID", gatewayStatus: "EXPIRED" };
  }

  const { status } = answer.status;
  if (status !== "PAID") return { outcome: "UNPAID", gatewayStatus: status };

  const { outcome } = await settleCheckoutPaidAtGateway(answer);
  // Nominal atau nomor transaksi yang tidak cocok sudah diteruskan ke staf;
  // checkout-nya dibiarkan menunggu, tidak ditutup.
  return outcome === "SETTLED" || outcome === "ALREADY_PAID"
    ? { outcome: "PAID" }
    : { outcome: "UNKNOWN" };
}

/**
 * Checkout gateway yang masih menunggu untuk invoice pelanggan ini,
 * ditanyakan ke gateway dan dilunasi bila sudah dibayar; null bila invoice
 * tidak punya checkout gateway yang menunggu.
 */
export async function reconcileInvoiceCheckout(input: {
  customerId: string;
  invoiceId: string;
}): Promise<CheckoutReconciliation | null> {
  const latest = await prismaBillingAuth.payment.findFirst({
    where: {
      pelangganId: input.customerId,
      invoiceId: input.invoiceId,
      gatewayStatus: "PENDING",
      expiresAt: { not: null },
    },
    orderBy: { paymentDate: "desc" },
    select: { id: true, checkoutId: true },
  });
  if (!latest) return null;

  const checkout = await prismaBillingAuth.payment.findMany({
    where: latest.checkoutId
      ? {
          pelangganId: input.customerId,
          checkoutId: latest.checkoutId,
          gatewayStatus: "PENDING",
        }
      : { id: latest.id },
    select: CHECKOUT_REF_SELECT,
  });
  return reconcileCheckout(checkout);
}

/**
 * Semua payment checkout-checkout ini, apa pun statusnya: orderId gateway
 * checkout lama bisa berada pada payment Rp 0 yang sudah PAID sejak dibuat.
 */
async function withWholeCheckouts(
  payments: CheckoutPaymentRef[],
): Promise<CheckoutPaymentRef[]> {
  const rows = await prismaBillingAuth.payment.findMany({
    where: { id: { in: payments.map((p) => p.id) }, checkoutId: { not: null } },
    select: { checkoutId: true },
  });
  const checkoutIds = [
    ...new Set(
      rows.flatMap((p): string[] => (p.checkoutId ? [p.checkoutId] : [])),
    ),
  ];
  if (checkoutIds.length === 0) return payments;

  const siblings = await prismaBillingAuth.payment.findMany({
    where: { checkoutId: { in: checkoutIds } },
    select: CHECKOUT_REF_SELECT,
  });
  const byId = new Map([...payments, ...siblings].map((p) => [p.id, p]));
  return [...byId.values()];
}

async function queryCheckoutStatus(
  payments: CheckoutPaymentRef[],
  options: StatusCheckOptions,
): Promise<
  | { paymentId: string; provider: string; status: TransactionStatus }
  | "NOT_FOUND"
  | "UNREADABLE"
> {
  const gateway = new PaymentGatewayManager();
  let isAnswered = false;
  for (const payment of orderByReference(payments)) {
    const provider = gatewayProviderOf(payment);
    if (!provider || !payment.reference) continue;
    try {
      const status = await gateway.checkPaymentStatus(
        provider,
        payment.reference,
        payment.tenantId ?? undefined,
        options,
      );
      return { paymentId: payment.id, provider, status };
    } catch (error) {
      // Hanya "tidak ditemukan" yang berarti salah reference; galat lain
      // berarti gateway tidak bisa ditanya sekarang.
      if (!(error instanceof GatewayTransactionNotFoundError)) {
        logger.warn("[Checkout] Status checkout tidak terbaca:", error);
        return "UNREADABLE";
      }
      isAnswered = true;
    }
  }
  return isAnswered ? "NOT_FOUND" : "UNREADABLE";
}
