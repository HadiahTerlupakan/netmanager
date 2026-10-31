import type { Job } from "bullmq";
import { createRouteServiceError } from "@/lib/api/route-service-error";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { logger } from "@/lib/logger";
import { prismaBillingAuth } from "@/lib/prisma-billing";
import type { Prisma } from "@/modules/finance";
import { releaseUnusedCheckoutCoupons } from "./abandoned-checkout";
import {
  gatewayProviderOf,
  reconcileCheckout,
} from "./checkout-reconciliation";
import { PaymentGatewayManager } from "./PaymentGatewayService";

const HTTP_CONFLICT = 409;
// Cek status checkout lama di dalam kunci checkout. Status yang tidak
// terbaca tidak menahan pelanggan, jadi batasnya cukup pendek.
const PREVIOUS_CHECKOUT_STATUS_TIMEOUT_MS = 10_000;
const ALREADY_PAID_MESSAGE =
  "Pembayaran sebelumnya sudah diterima. Muat ulang halaman untuk melihat status tagihan terbaru.";
const RECEIPT_UNDER_REVIEW_MESSAGE =
  "Bukti transfer untuk tagihan ini sedang diverifikasi admin. Tunggu hasilnya, atau batalkan transfer manual itu bila ingin memakai metode lain.";

const PENDING_CHECKOUT_SELECT = {
  id: true,
  checkoutId: true,
  reference: true,
  gatewayProvider: true,
  couponUsageId: true,
  couponId: true,
  tenantId: true,
  accountId: true,
  receiptUrl: true,
  expiresAt: true,
} as const;

type PendingCheckoutPayment = {
  id: string;
  checkoutId: string | null;
  reference: string | null;
  gatewayProvider: string | null;
  couponUsageId: string | null;
  couponId: string | null;
  tenantId: string | null;
  accountId: string | null;
  receiptUrl: string | null;
  expiresAt: Date | null;
};

// Checkout gateway dikenali dari batas waktunya, transfer manual dari
// rekening tujuannya.
const GATEWAY_CHECKOUT: Prisma.PaymentWhereInput = { expiresAt: { not: null } };
const REPLACEABLE_CHECKOUT: Prisma.PaymentWhereInput = {
  OR: [GATEWAY_CHECKOUT, { accountId: { not: null } }],
};

/** Checkout menunggu yang akan diganti oleh checkout baru pelanggan. */
export type ReplaceableCheckouts = {
  payments: PendingCheckoutPayment[];
  /** Pemesanan kupon checkout lama, bisa dipindah ke checkout baru. */
  heldCoupon: { couponId: string; couponUsageId: string } | null;
};

/**
 * Pelanggan yang mengganti metode (VA ke QRIS, misalnya) atau memilih
 * Transfer Manual lagi membuat checkout baru untuk invoice yang masih punya
 * checkout menunggu. Checkout lama baru ditutup setelah penggantinya berhasil
 * dibuat (closeReplacedCheckouts): bila gateway menolak metode baru, VA/QR
 * lama tetap tampil dan tetap bisa dibayar.
 *
 * Menolak dengan 409 bila bukti transfer manual sedang diverifikasi admin,
 * atau bila checkout gateway lama ternyata sudah dibayar (dan langsung
 * dilunasi lewat jalur webhook).
 */
export async function findReplaceableCheckouts(input: {
  customerId: string;
  invoiceIds: string[];
}): Promise<ReplaceableCheckouts> {
  const payments = await findPendingCheckoutPayments(
    input,
    REPLACEABLE_CHECKOUT,
  );
  if (payments.some((payment) => payment.accountId && payment.receiptUrl)) {
    throw createRouteServiceError(RECEIPT_UNDER_REVIEW_MESSAGE, HTTP_CONFLICT);
  }
  if (await anyGatewayCheckoutPaid(payments)) {
    throw createRouteServiceError(ALREADY_PAID_MESSAGE, HTTP_CONFLICT);
  }

  return { payments, heldCoupon: findHeldCoupon(payments) };
}

function findHeldCoupon(
  payments: PendingCheckoutPayment[],
): ReplaceableCheckouts["heldCoupon"] {
  for (const { couponId, couponUsageId } of payments) {
    if (couponId && couponUsageId) return { couponId, couponUsageId };
  }
  return null;
}

/**
 * Tutup checkout lama setelah checkout penggantinya berhasil dibuat. Kupon
 * yang pemesanannya dipindah ke checkout baru tidak dikembalikan.
 *
 * Duitku dan sebagian gateway tidak bisa menutup VA lebih awal, jadi VA lama
 * tetap bisa dibayar sampai kedaluwarsa. Webhook tetap melunasi payment
 * CANCELLED yang ternyata dibayar, dan kelebihannya masuk saldo pelanggan.
 */
export async function closeReplacedCheckouts(
  previous: ReplaceableCheckouts,
  options: { keptCouponUsageId: string | null },
) {
  if (previous.payments.length === 0) return 0;

  const kept = options.keptCouponUsageId;
  if (kept) {
    await prismaBillingAuth.payment.updateMany({
      where: {
        id: { in: previous.payments.map((p) => p.id) },
        couponUsageId: kept,
      },
      data: { couponUsageId: null },
    });
  }
  return closeCheckouts(
    previous.payments.map((payment) =>
      kept && payment.couponUsageId === kept
        ? { ...payment, couponUsageId: null }
        : payment,
    ),
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
  const pending = await findPendingCheckoutPayments(
    { customerId, invoiceIds: [invoiceId] },
    GATEWAY_CHECKOUT,
  );
  if (pending.length === 0) return;

  const closed = await closeCheckouts(pending);
  logger.info(
    `[Checkout] ${closed} payment menunggu ditutup karena invoice ${invoiceId} lunas`,
  );
}

// Hanya payment yang benar-benar berpindah ke CANCELLED yang kuponnya
// dilepas dan dibatalkan di gateway: callback bisa melunasinya di antara
// pencarian dan penutupan.
async function closeCheckouts(pending: PendingCheckoutPayment[]) {
  const cancelled = await prismaBillingAuth.payment.updateManyAndReturn({
    where: { id: { in: pending.map((p) => p.id) }, gatewayStatus: "PENDING" },
    data: { gatewayStatus: "CANCELLED" },
    select: { id: true },
  });
  const cancelledIds = new Set(cancelled.map((p) => p.id));
  const closed = pending.filter((p) => cancelledIds.has(p.id));
  await releaseUnusedCheckoutCoupons(closed);
  await cancelAtGateway(closed);
  return cancelled.length;
}

// Satu checkout bisa mencakup invoice lain milik pelanggan yang sama; seluruh
// kelompoknya ikut karena gateway menagih totalnya sekaligus.
async function findPendingCheckoutPayments(
  input: { customerId: string; invoiceIds: string[] },
  kind: Prisma.PaymentWhereInput,
): Promise<PendingCheckoutPayment[]> {
  const direct = await prismaBillingAuth.payment.findMany({
    where: {
      ...kind,
      pelangganId: input.customerId,
      invoiceId: { in: input.invoiceIds },
      gatewayStatus: "PENDING",
    },
    select: PENDING_CHECKOUT_SELECT,
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
    select: PENDING_CHECKOUT_SELECT,
  });
  const byId = new Map([...direct, ...grouped].map((p) => [p.id, p]));
  return [...byId.values()];
}

// Ditanyakan paralel dengan satu batas waktu pendek, agar kunci checkout
// tidak habis menunggu gateway yang lambat.
async function anyGatewayCheckoutPaid(payments: PendingCheckoutPayment[]) {
  const checkouts = new Map<string, PendingCheckoutPayment[]>();
  for (const payment of payments) {
    if (!payment.expiresAt) continue;
    const key = payment.checkoutId ?? payment.id;
    checkouts.set(key, [...(checkouts.get(key) ?? []), payment]);
  }
  const results = await Promise.all(
    [...checkouts.values()].map((checkout) =>
      reconcileCheckout(checkout, {
        timeoutMs: PREVIOUS_CHECKOUT_STATUS_TIMEOUT_MS,
      }),
    ),
  );
  return results.some((result) => result.outcome === "PAID");
}

async function cancelAtGateway(pending: PendingCheckoutPayment[]) {
  const gateway = new PaymentGatewayManager();
  await Promise.all(
    pending.map(async (payment) => {
      const provider = gatewayProviderOf(payment);
      if (!provider || !payment.reference) return;
      try {
        const instance = await gateway.getIssuedTransactionProvider(
          provider,
          payment.tenantId ?? undefined,
        );
        await instance.cancelPayment(payment.reference);
      } catch (error) {
        logger.warn("[Checkout] Gagal membatalkan checkout di gateway:", error);
      }
    }),
  );
}
