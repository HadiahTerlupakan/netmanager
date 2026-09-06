import { hasPermission } from "@/lib/rbac";
import { getTaxPeriodService } from "@/modules/tax";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/tax/period/[year]/[month] - Get period summary
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

  const year = parseInt(ctx.params.year, 10);
  const month = parseInt(ctx.params.month, 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return ApiErrors.badRequest("Parameter year/month tidak valid");
  }

  const service = getTaxPeriodService();
  const summary = await service.getSummary(tenantId, year, month);

  if (!summary) {
    return ApiErrors.notFound("Data periode pajak");
  }

  return apiSuccess(summary);
});

/**
 * POST /api/admin/tax/period/[year]/[month] - Trigger recalculate
 */
export const POST = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("tax:manage"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk mengelola pajak",
    );
  }

  const tenantId = ctx.session?.user.tenantId;
  if (!tenantId) {
    return ApiErrors.badRequest("Tenant ID tidak ditemukan");
  }

  const year = parseInt(ctx.params.year, 10);
  const month = parseInt(ctx.params.month, 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return ApiErrors.badRequest("Parameter year/month tidak valid");
  }

  const service = getTaxPeriodService();
  const summary = await service.recalculate(tenantId, year, month);
  return apiSuccess(summary, {
    message: "Periode pajak berhasil dihitung ulang",
  });
});
