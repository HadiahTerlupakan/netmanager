import { prisma } from "@/lib/prisma";

export interface CouponAnalyticsSummary {
  totalActive: number;
  totalExpiringSoon: number;
  totalUsageLast30Days: number;
  redemptionRatePct: number;
  totalDiscountValueLast30Days: bigint;
}

export interface TopCoupon {
  couponId: string;
  code: string;
  description: string | null;
  usedCount: number;
  quota: number;
  redemptionRatePct: number;
  endDate: Date;
}

export interface ExpiringCoupon {
  couponId: string;
  code: string;
  endDate: Date;
  daysUntilExpiry: number;
  remainingQuota: number;
}

export interface CouponAnalyticsResult {
  summary: CouponAnalyticsSummary;
  topByUsage: TopCoupon[];
  expiringSoon: ExpiringCoupon[];
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const EXPIRING_WINDOW_DAYS = 14;
const ANALYTICS_WINDOW_DAYS = 30;

/** Service compute analytics untuk dashboard coupons. */
export class CouponAnalyticsService {
  /** Compute full analytics snapshot. */
  async compute(now = new Date()): Promise<CouponAnalyticsResult> {
    const [activeCoupons, expiringSoon, recentUsages, topByUsage] =
      await Promise.all([
        this.fetchActiveCoupons(now),
        this.fetchExpiringSoon(now),
        this.fetchRecentUsageCount(now),
        this.fetchTopByUsage(),
      ]);

    const totalQuota = activeCoupons.reduce((acc, c) => acc + c.quota, 0);
    const totalUsed = activeCoupons.reduce((acc, c) => acc + c.usedCount, 0);
    const redemptionRatePct =
      totalQuota > 0 ? (totalUsed / totalQuota) * 100 : 0;

    const totalDiscount = await this.fetchDiscountValueLast30Days(now);

    return {
      summary: {
        totalActive: activeCoupons.length,
        totalExpiringSoon: expiringSoon.length,
        totalUsageLast30Days: recentUsages,
        redemptionRatePct,
        totalDiscountValueLast30Days: totalDiscount,
      },
      topByUsage,
      expiringSoon: expiringSoon.map((c) => ({
        couponId: c.id,
        code: c.code,
        endDate: c.endDate,
        daysUntilExpiry: Math.ceil(
          (c.endDate.getTime() - now.getTime()) / MS_PER_DAY,
        ),
        remainingQuota: Math.max(0, c.quota - c.usedCount),
      })),
    };
  }

  private async fetchActiveCoupons(now: Date) {
    return prisma.coupon.findMany({
      where: {
        isActive: true,
        endDate: { gte: now },
      },
      select: {
        id: true,
        code: true,
        usedCount: true,
        quota: true,
        endDate: true,
      },
    });
  }

  private async fetchExpiringSoon(now: Date) {
    const cutoff = new Date(now.getTime() + EXPIRING_WINDOW_DAYS * MS_PER_DAY);
    return prisma.coupon.findMany({
      where: {
        isActive: true,
        endDate: { gte: now, lte: cutoff },
      },
      orderBy: { endDate: "asc" },
      select: {
        id: true,
        code: true,
        endDate: true,
        usedCount: true,
        quota: true,
      },
    });
  }

  private async fetchRecentUsageCount(now: Date): Promise<number> {
    const since = new Date(now.getTime() - ANALYTICS_WINDOW_DAYS * MS_PER_DAY);
    return prisma.couponUsage.count({
      where: { usedAt: { gte: since } },
    });
  }

  private async fetchTopByUsage(): Promise<TopCoupon[]> {
    const coupons = await prisma.coupon.findMany({
      orderBy: { usedCount: "desc" },
      take: 10,
      select: {
        id: true,
        code: true,
        description: true,
        usedCount: true,
        quota: true,
        endDate: true,
      },
    });

    return coupons.map((c) => ({
      couponId: c.id,
      code: c.code,
      description: c.description,
      usedCount: c.usedCount,
      quota: c.quota,
      redemptionRatePct: c.quota > 0 ? (c.usedCount / c.quota) * 100 : 0,
      endDate: c.endDate,
    }));
  }

  /**
   * Estimasi total nominal diskon dari usage 30 hari terakhir.
   * Karena CouponUsage tidak menyimpan nominal final, kita estimasi
   * dari `discountValue` per coupon (PERCENTAGE atau FIXED).
   */
  private async fetchDiscountValueLast30Days(now: Date): Promise<bigint> {
    const since = new Date(now.getTime() - ANALYTICS_WINDOW_DAYS * MS_PER_DAY);
    const usagesByCoupon = await prisma.couponUsage.groupBy({
      by: ["couponId"],
      where: { usedAt: { gte: since } },
      _count: true,
    });

    if (usagesByCoupon.length === 0) return 0n;

    const couponIds = usagesByCoupon.map((g) => g.couponId);
    const coupons = await prisma.coupon.findMany({
      where: { id: { in: couponIds } },
      select: {
        id: true,
        discountType: true,
        discountValue: true,
        maxDiscount: true,
      },
    });

    const couponMap = new Map(coupons.map((c) => [c.id, c]));
    let total = 0n;

    for (const usage of usagesByCoupon) {
      const coupon = couponMap.get(usage.couponId);
      if (!coupon) continue;
      // Untuk PERCENT pakai maxDiscount sebagai upper bound estimasi.
      // Untuk FIXED langsung pakai discountValue.
      const perUsage =
        coupon.discountType === "PERCENT"
          ? BigInt(coupon.maxDiscount ?? 0)
          : BigInt(Math.round(coupon.discountValue));
      total += perUsage * BigInt(usage._count);
    }

    return total;
  }
}

let instance: CouponAnalyticsService | null = null;

export function getCouponAnalyticsService(): CouponAnalyticsService {
  instance ??= new CouponAnalyticsService();
  return instance;
}
