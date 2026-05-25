import { hasPermission } from "@/lib/rbac";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { getCustomerCohortService } from "@/modules/finance";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/finance/customer-cohort
 * Query params:
 * - months=<n>     : ambil N bulan cohort terakhir (default 12)
 * - recompute=true : force compute ulang sebelum return
 */
export const GET = createHandler({ auth: true }, async (req) => {
  if (!(await hasPermission("finance:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat customer cohort",
    );
  }

  try {
    const url = req.nextUrl;
    const months = Number(url.searchParams.get("months") ?? 12);
    const wantsRecompute = url.searchParams.get("recompute") === "true";

    const service = getCustomerCohortService();

    if (wantsRecompute) {
      await service.computeAndSaveAll(months);
    }

    const cohorts = await service.getAllCohorts(months);

    return apiSuccess({
      cohorts: cohorts.map((c) => ({
        ...c,
        month0Revenue: c.month0Revenue.toString(),
        month1Revenue: c.month1Revenue.toString(),
        month2Revenue: c.month2Revenue.toString(),
        month3Revenue: c.month3Revenue.toString(),
        month6Revenue: c.month6Revenue.toString(),
        month12Revenue: c.month12Revenue.toString(),
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    });
  } catch (error: unknown) {
    logger.error("[Admin Customer Cohort] Error:", error);
    return ApiErrors.internalError(
      error instanceof Error
        ? error.message
        : "Gagal mengambil data customer cohort",
    );
  }
});
