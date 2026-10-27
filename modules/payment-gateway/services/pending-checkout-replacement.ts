import type { Job } from "bullmq";
import { createRouteServiceError } from "@/lib/api/route-service-error";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { logger } from "@/lib/logger";
import { prismaBillingAuth } from "@/lib/prisma-billing";
import { releaseCheckoutCoupons } from "./abandoned-checkout";
import { findPaymentMethodProvider } from "./payment-method-catalog";
import { PaymentGatewayManager } from "./PaymentGatewayService";

const HTTP_CONFLICT = 409;
// Pembuatan checkout memanggil gateway (beberapa detik); permintaan kedua
// pelanggan yang sama menunggu di kunci selama itu.
const CHECKOUT_LOCK_TIMEOUT_MS = 60_000;
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

  return closeCheckouts(gateway, pending, input.tenantId);
}

/**
 * Satu checkout per pelanggan dalam satu waktu. Tanpa kunci, dua perangkat
 * yang menekan "Ganti Metode" bersamaan sama-sama menutup checkout lama lalu
 * masing-masing membuat checkout baru, sehingga ada dua VA/QR yang bisa
 * dibayar untuk satu tagihan. Kunci advisory lepas sendiri bersama
 * transaksinya.
 */
export function withCustomerCheckoutLock<T>(
  customerId: string,
  task: () => Promise<T>,
): Promise<T> {
  const key = `checkout:${customerId}`;
  return prismaBillingAuth.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
      return task();
    },
    { maxWait: CHECKOUT_LOCK_TIMEOUT_MS, timeout: CHECKOUT_LOCK_TIMEOUT_MS },
  );
}

/**
 * INVOICE_PAID: checkout gateway lain untuk invoice yang sudah lunas (mis.
 * QRIS yang dibuat sebelum VA lama ternyata dibayar) ditutup, agar tidak
 * ada pembayaran kedua. Berlaku untuk semua jalur pelunasan: webhook,
 * transfer manual, dan admin.
 */
export async function handleInvoicePaidCheckoutCleanup(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const source = "InvoicePaidCheckoutCleanup";
  const invoiceId = requirePayloadString(
    payload.invoiceId,
    "invoiceId",
    source,
  );
  const customerId = requirePayloadString(
    payload.pelangganId,
    "pelangganId",
    source,
  );
  const pending = await findPendingCheckoutPayments({
    customerId,
    invoiceIds: [invoiceId],
  });
  if (pending.length === 0) return;

  const closed = await closeCheckouts(
    new PaymentGatewayManager(),
    pending,
    pending[0].tenantId,
  );
  logger.info(
    `[Checkout] ${closed} payment menunggu ditutup karena invoice ${invoiceId} lunas`,
  );
}

async function closeCheckouts(
  gateway: PaymentGatewayManager,
  pending: PendingGatewayPayment[],
  tenantId?: string | null,
) {
  const { count } = await prismaBillingAuth.payment.updateMany({
    where: { id: { in: pending.map((p) => p.id) }, gatewayStatus: "PENDING" },
    data: { gatewayStatus: "CANCELLED" },
  });
  await releaseCheckoutCoupons(pending);
  await cancelAtGateway(gateway, pending, tenantId);
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
