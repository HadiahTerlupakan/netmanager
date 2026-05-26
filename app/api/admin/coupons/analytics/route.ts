import { hasPermission } from "@/lib/rbac";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { getCouponAnalyticsService } from "@/modules/coupons";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/** GET /api/admin/coupons/analytics — analytics dashboard data. */
export const GET = createHandler({ auth: true }, async () => {
  if (!(await hasPermission("coupon:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat analytics coupon",
    );
  }

  try {
    const result = await getCouponAnalyticsService().compute();
    return apiSuccess({
      summary: {
        ...result.summary,
        totalDiscountValueLast30Days:
          result.summary.totalDiscountValueLast30Days.toString(),
      },
      topByUsage: result.topByUsage.map((c) => ({
        ...c,
        endDate: c.endDate.toISOString(),
      })),
      expiringSoon: result.expiringSoon.map((c) => ({
        ...c,
        endDate: c.endDate.toISOString(),
      })),
    });
  } catch (error: unknown) {
    logger.error("[Coupon Analytics] Error:", error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : "Gagal mengambil analytics",
    );
  }
});
