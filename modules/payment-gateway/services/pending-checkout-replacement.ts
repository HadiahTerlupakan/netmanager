import { createRouteServiceError } from "@/lib/api/route-service-error";
import { logger } from "@/lib/logger";
import { prismaBillingAuth } from "@/lib/prisma-billing";
import { releaseCheckoutCoupons } from "./abandoned-checkout";
import { findPaymentMethodProvider } from "./payment-method-catalog";
import { PaymentGatewayManager } from "./PaymentGatewayService";

const HTTP_CONFLICT = 409;
const ALREADY_PAID_MESSAGE =
  "Pembayaran sebelumnya sudah diterima dan sedang diproses. Muat ulang halaman beberapa saat lagi.";

type PendingGatewayPayment = {
  id: string;
  checkoutId: string | null;
  reference: string | null;
  gatewayProvider: string | null;
  couponUsageId: string | null;
  tenantId: string | null;
};

/**
 * Pelanggan yang mengganti metode (VA ke QRIS, misalnya) membuat checkout
 * baru untuk invoice yang masih punya checkout gateway PENDING. Checkout lama
 * ditutup lebih dulu agar kuponnya kembali dan portal tidak menampilkan dua
 * tagihan menunggu.
 *
 * Duitku dan sebagian gateway tidak bisa menutup VA lebih awal, jadi VA lama
 * tetap bisa dibayar sampai kedaluwarsa. Webhook tetap melunasi payment
 * CANCELLED yang ternyata dibayar, supaya uang pelanggan tidak hilang.
 */
export async function replacePendingGatewayCheckouts(input: {
  customerId: string;
  invoiceIds: string[];
  tenantId?: string | null;
}) {
  const pending = await findPendingCheckoutPayments(input);
  if (pending.length === 0) return 0;

  const gateway = new PaymentGatewayManager();
  if (await anyAlreadyPaid(gateway, pending, input.tenantId)) {
    throw createRouteServiceError(ALREADY_PAID_MESSAGE, HTTP_CONFLICT);
  }

  const { count } = await prismaBillingAuth.payment.updateMany({
    where: { id: { in: pending.map((p) => p.id) }, gatewayStatus: "PENDING" },
    data: { gatewayStatus: "CANCELLED" },
  });
  await releaseCheckoutCoupons(pending);
  await cancelAtGateway(gateway, pending, input.tenantId);
  return count;
}

// Satu checkout bisa mencakup invoice lain milik pelanggan yang sama; seluruh
// kelompoknya ikut ditutup karena gateway menagih totalnya sekaligus.
async function findPendingCheckoutPayments(input: {
  customerId: string;
  invoiceIds: string[];
}): Promise<PendingGatewayPayment[]> {
  const select = {
    id: true,
    checkoutId: true,
    reference: true,
    gatewayProvider: true,
    couponUsageId: true,
    tenantId: true,
  } as const;
  // Transfer manual tidak punya expiresAt; buktinya mungkin sedang
  // diverifikasi admin, jadi tidak ikut ditutup.
  const direct = await prismaBillingAuth.payment.findMany({
    where: {
      pelangganId: input.customerId,
      invoiceId: { in: input.invoiceIds },
      gatewayStatus: "PENDING",
      expiresAt: { not: null },
    },
    select,
  });
  const checkoutIds = [
    ...new Set(direct.flatMap((p) => (p.checkoutId ? [p.checkoutId] : []))),
  ];
  if (checkoutIds.length === 0) return direct;

  const grouped = await prismaBillingAuth.payment.findMany({
    where: {
      pelangganId: input.customerId,
      checkoutId: { in: checkoutIds },
      gatewayStatus: "PENDING",
    },
    select,
  });
  const byId = new Map([...direct, ...grouped].map((p) => [p.id, p]));
  return [...byId.values()];
}

// Portal menyimpan kode channel (mis. "BC"); webhook menimpanya dengan nama
// provider (mis. "DUITKU").
function providerOf(payment: PendingGatewayPayment) {
  const stored = payment.gatewayProvider;
  return stored ? (findPaymentMethodProvider(stored) ?? stored) : null;
}

// Gateway hanya mengenal orderId payment pertama sebuah checkout; reference
// lain dijawab "tidak ditemukan", yang tidak dihitung lunas.
async function anyAlreadyPaid(
  gateway: PaymentGatewayManager,
  pending: PendingGatewayPayment[],
  tenantId?: string | null,
) {
  for (const payment of pending) {
    const provider = providerOf(payment);
    if (!provider || !payment.reference) continue;
    try {
      const status = await gateway.checkPaymentStatus(
        provider,
        payment.reference,
        tenantId ?? undefined,
      );
      if (status.status === "PAID") return true;
    } catch (error) {
      // Status yang tidak terbaca tidak menahan pelanggan: bila checkout lama
      // ternyata dibayar, webhook-nya tetap melunasi invoice.
      logger.warn("[Checkout] Gagal mengecek status checkout lama:", error);
    }
  }
  return false;
}

async function cancelAtGateway(
  gateway: PaymentGatewayManager,
  pending: PendingGatewayPayment[],
  tenantId?: string | null,
) {
  for (const payment of pending) {
    const provider = providerOf(payment);
    if (!provider || !payment.reference) continue;
    try {
      const instance = await gateway.getProviderInstance(
        provider,
        tenantId ?? undefined,
      );
      await instance.cancelPayment(payment.reference);
    } catch (error) {
      logger.warn("[Checkout] Gagal membatalkan checkout di gateway:", error);
    }
  }
}
