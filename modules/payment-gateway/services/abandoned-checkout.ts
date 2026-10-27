import { logger } from "@/lib/logger";
import { prismaBillingAuth } from "@/lib/prisma-billing";
import {
  runAsSystemContext,
  runWithRequestTenantContext,
} from "@/lib/tenant-context";
import { couponService } from "@/modules/coupons";

const UNPAID_TERMINAL_STATUSES = new Set(["EXPIRED", "FAILED", "CANCELLED"]);
// Gateway kadang mengirim notifikasi PAID sedikit setelah batas waktunya;
// payment baru ditutup setelah jeda ini.
const EXPIRY_GRACE_MS = 60 * 60 * 1000;
const SWEEP_BATCH_SIZE = 500;

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
 */
export async function expireStaleGatewayPayments(now = new Date()) {
  const stale = await prismaBillingAuth.payment.findMany({
    where: {
      gatewayStatus: "PENDING",
      expiresAt: { lt: new Date(now.getTime() - EXPIRY_GRACE_MS) },
    },
    select: { id: true, couponUsageId: true, tenantId: true },
    take: SWEEP_BATCH_SIZE,
  });
  if (stale.length === 0) return 0;

  const { count } = await prismaBillingAuth.payment.updateMany({
    where: { id: { in: stale.map((p) => p.id) }, gatewayStatus: "PENDING" },
    data: { gatewayStatus: "EXPIRED" },
  });
  await releaseCheckoutCoupons(stale);
  return count;
}
