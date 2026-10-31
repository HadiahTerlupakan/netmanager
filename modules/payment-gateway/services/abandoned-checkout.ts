import { logger } from "@/lib/logger";
import { prismaBillingAuth } from "@/lib/prisma-billing";
import {
  runAsSystemContext,
  runWithRequestTenantContext,
} from "@/lib/tenant-context";
import { couponService } from "@/modules/coupons";
import { BillingEventDispatcher } from "@/modules/events";
import { reconcileCheckout } from "./checkout-reconciliation";
import { tryWithCustomerCheckoutLock } from "./customer-checkout-lock";

const UNPAID_TERMINAL_STATUSES = new Set(["EXPIRED", "FAILED", "CANCELLED"]);
// Gateway kadang mengirim notifikasi PAID sedikit setelah batas waktunya;
// payment baru ditutup setelah jeda ini.
const EXPIRY_GRACE_MS = 60 * 60 * 1000;
const SWEEP_BATCH_SIZE = 500;
// Duitku memblokir merchant sekitar satu jam bila cek status terlalu sering;
// sisanya ditanyakan pada putaran berikutnya (tiap 15 menit).
const MAX_CHECKOUTS_RECONCILED_PER_SWEEP = 50;

type CouponHolder = {
  id?: string;
  couponUsageId: string | null;
  couponId?: string | null;
  pelangganId?: string;
  tenantId: string | null;
};

/** Status gateway yang berarti checkout berakhir tanpa dibayar. */
export function isUnpaidTerminalStatus(status: string): boolean {
  return UNPAID_TERMINAL_STATUSES.has(status);
}

/**
 * Kembalikan kuota kupon checkout yang tidak dibayar. Kupon ada di database
 * utama yang berisolasi tenant, sedangkan pemanggilnya (webhook, cron)
 * berjalan tanpa konteks tenant.
 */
export async function releaseCheckoutCoupons(payments: CouponHolder[]) {
  const released = new Set<string>();
  for (const payment of payments) {
    const usageId = payment.couponUsageId;
    if (!usageId || released.has(usageId)) continue;
    released.add(usageId);

    try {
      await inCouponTenant(payment.tenantId, () =>
        couponService.releaseUsage(usageId),
      );
      // Penanda bahwa kupon checkout ini sudah dikembalikan; dibaca bila
      // checkout ternyata dibayar belakangan.
      await prismaBillingAuth.payment.updateMany({
        where: { couponUsageId: usageId },
        data: { couponUsageId: null },
      });
    } catch (error) {
      // Satu kupon yang gagal dikembalikan tidak boleh menahan yang lain;
      // kuota yang tertahan terlihat di riwayat pemakaian kupon.
      logger.error("[Checkout] Gagal mengembalikan kupon:", error);
    }
  }
}

/**
 * Kembalikan kupon payment yang baru saja ditutup, kecuali pemesanan yang
 * masih dipegang payment lain yang hidup (menunggu atau lunas): checkout yang
 * sebagian invoicenya sudah lunas dengan potongan itu, atau pemesanan yang
 * dipindah ke checkout baru, tetap memakai kuponnya.
 */
export async function releaseUnusedCheckoutCoupons(closed: CouponHolder[]) {
  const usageIds = [
    ...new Set(
      closed.flatMap((p) => (p.couponUsageId ? [p.couponUsageId] : [])),
    ),
  ];
  if (usageIds.length === 0) return;

  const held = await prismaBillingAuth.payment.findMany({
    where: {
      couponUsageId: { in: usageIds },
      gatewayStatus: { in: ["PENDING", "PAID"] },
    },
    select: { couponUsageId: true },
  });
  const heldUsageIds = new Set(held.map((p) => p.couponUsageId));
  await releaseCheckoutCoupons(
    closed.filter((p) => p.couponUsageId && !heldUsageIds.has(p.couponUsageId)),
  );
}

function inCouponTenant<T>(tenantId: string | null, task: () => Promise<T>) {
  return tenantId
    ? runWithRequestTenantContext({ tenantId, isSuperAdmin: false }, task)
    : runAsSystemContext("checkout kupon tanpa tenant", task);
}

/**
 * Checkout yang kuponnya sudah dikembalikan (kedaluwarsa, gagal) lalu
 * ternyata dibayar: pelanggan tetap membayar nominal berpotongan, jadi
 * pemakaiannya dicatat ulang walau kuota sudah habis, alih-alih menolak
 * uang yang sudah masuk.
 */
export async function restoreReleasedCoupons(payments: CouponHolder[]) {
  const released = payments.find(
    (p) => p.couponId && !p.couponUsageId && p.pelangganId,
  );
  if (!released?.couponId || !released.pelangganId) return;

  const { couponId, pelangganId } = released;
  try {
    const usageId = await inCouponTenant(released.tenantId, () =>
      couponService.restoreUsage(couponId, pelangganId),
    );
    logger.warn(
      `[Checkout] Kupon ${couponId} dicatat ulang untuk checkout kedaluwarsa yang dibayar`,
    );
    await prismaBillingAuth.payment.updateMany({
      where: {
        id: { in: payments.flatMap((p) => (p.id ? [p.id] : [])) },
        couponId,
        couponUsageId: null,
      },
      data: { couponUsageId: usageId },
    });
  } catch (error) {
    // Pelunasan tetap jalan: uang pelanggan sudah masuk.
    logger.error("[Checkout] Gagal mencatat ulang kupon:", error);
  }
}

/**
 * Tutup payment gateway yang lewat batas waktu tanpa notifikasi apa pun
 * (pelanggan meninggalkan halaman bayar) dan kembalikan kuponnya. Transfer
 * manual tidak punya expiresAt, jadi tidak tersentuh.
 *
 * Gateway ditanya dulu per checkout: yang ternyata dibayar (callback-nya
 * hilang) dilunasi, dan yang statusnya tidak terbaca dibiarkan untuk putaran
 * berikutnya. Hanya checkout yang menurut gateway belum dibayar yang ditutup,
 * per pelanggan di bawah kunci checkout-nya (expireCustomerCheckouts).
 */
export async function expireStaleGatewayPayments(now = new Date()) {
  const stale = await prismaBillingAuth.payment.findMany({
    where: {
      gatewayStatus: "PENDING",
      expiresAt: { lt: new Date(now.getTime() - EXPIRY_GRACE_MS) },
    },
    select: {
      id: true,
      couponUsageId: true,
      tenantId: true,
      checkoutId: true,
      pelangganId: true,
      invoiceId: true,
      amount: true,
      reference: true,
      gatewayProvider: true,
      invoice: { select: { dueDate: true } },
    },
    // Yang baru lewat batas waktu lebih dulu: callback yang hilang paling
    // mungkin di sana, dan checkout lama yang statusnya tak kunjung terbaca
    // tidak menahan yang baru.
    orderBy: { expiresAt: "desc" },
    take: SWEEP_BATCH_SIZE,
  });
  const unpaid = await keepUnpaidCheckouts(stale);

  let expiredCount = 0;
  for (const [customerId, payments] of groupBy(unpaid, (p) => p.pelangganId)) {
    expiredCount += await expireCustomerCheckouts(customerId, payments);
  }
  return expiredCount;
}

/**
 * Ganti metode memindah pemesanan kupon checkout lama ke checkout baru
 * sebelum baris payment barunya ada. Menutup checkout lama di antara keduanya
 * melepas kupon yang akan dipakai checkout baru, jadi penutupan dan pelepasan
 * kupon memegang kunci yang sama dengan pembuatan checkout. Gateway ditanya
 * sebelumnya, di luar kunci, agar pelanggan tidak tertahan menunggu gateway.
 * Pelanggan yang sedang membuat checkout dilewati; payment-nya tetap PENDING
 * dan ditanyakan lagi pada putaran berikutnya.
 */
async function expireCustomerCheckouts<T extends ExpiredPayment>(
  customerId: string,
  unpaid: T[],
) {
  const attempt = await tryWithCustomerCheckoutLock(customerId, async () => {
    // Hanya yang benar-benar berpindah ke EXPIRED yang kuponnya dilepas dan
    // diberi tahu: callback bisa melunasinya di antara pertanyaan dan
    // penutupan, dan ganti metode menutupnya sebagai CANCELLED.
    const expired = await prismaBillingAuth.payment.updateManyAndReturn({
      where: { id: { in: unpaid.map((p) => p.id) }, gatewayStatus: "PENDING" },
      data: { gatewayStatus: "EXPIRED" },
      select: { id: true },
    });
    const expiredIds = new Set(expired.map((p) => p.id));
    const closed = unpaid.filter((p) => expiredIds.has(p.id));
    await releaseUnusedCheckoutCoupons(closed);
    return closed;
  });
  if (!attempt.isAcquired) {
    logger.info(
      `[Checkout] Pelanggan ${customerId} sedang membuat checkout; penutupan checkout lamanya menunggu putaran berikutnya`,
    );
    return 0;
  }

  await notifyExpiredCheckouts(attempt.value);
  return attempt.value.length;
}

async function keepUnpaidCheckouts<
  T extends ExpiredPayment & {
    reference: string | null;
    gatewayProvider: string | null;
  },
>(payments: T[]) {
  const checkouts = [...groupByCheckout(payments).values()].slice(
    0,
    MAX_CHECKOUTS_RECONCILED_PER_SWEEP,
  );
  const unpaid: T[] = [];
  for (const checkout of checkouts) {
    const { outcome } = await reconcileCheckout(checkout);
    if (outcome === "UNPAID") unpaid.push(...checkout);
  }
  return unpaid;
}

type ExpiredPayment = {
  id: string;
  checkoutId: string | null;
  couponUsageId: string | null;
  pelangganId: string;
  invoiceId: string | null;
  amount: bigint;
  tenantId: string | null;
  invoice: { dueDate: Date } | null;
};

function groupBy<T>(items: T[], keyOf: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

function groupByCheckout<T extends { id: string; checkoutId: string | null }>(
  payments: T[],
) {
  return groupBy(payments, (payment) => payment.checkoutId ?? payment.id);
}

// Satu pemberitahuan per checkout, bukan per invoice di dalamnya.
async function notifyExpiredCheckouts(payments: ExpiredPayment[]) {
  for (const group of groupByCheckout(payments).values()) {
    const first = group[0];
    if (!first.invoiceId) continue;
    try {
      await BillingEventDispatcher.onPaymentFailed({
        invoiceId: first.invoiceId,
        pelangganId: first.pelangganId,
        amount: Number(group.reduce((sum, p) => sum + p.amount, 0n)),
        dueDate: (first.invoice?.dueDate ?? new Date()).toISOString(),
        tenantId: first.tenantId ?? undefined,
      });
    } catch (error) {
      // Pemberitahuan gagal tidak membatalkan penutupan checkout.
      logger.error("[Checkout] Gagal mengirim event kedaluwarsa:", error);
    }
  }
}
