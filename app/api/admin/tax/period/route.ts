import { hasPermission } from "@/lib/rbac";
import { getTaxPeriodService } from "@/modules/tax";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/tax/period - List tax period summaries by year
 */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("tax:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat data pajak",
    );
  }

  const tenantId = ctx.session?.user.tenantId;
  if (!tenantId) {
    return ApiErrors.badRequest("Tenant ID tidak ditemukan");
  }

  const yearParam = ctx.query.year as string | undefined;
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  if (isNaN(year) || year < 2000 || year > 2100) {
    return ApiErrors.badRequest("Parameter year tidak valid");
  }

  const service = getTaxPeriodService();
  const periods = await service.listByYear(tenantId, year);
  return apiSuccess(periods);
});
