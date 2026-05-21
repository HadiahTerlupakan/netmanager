import { hasPermission } from "@/lib/rbac";
import { getTaxTransactionService } from "@/modules/tax";
import type { TaxType } from "@/modules/tax";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/tax/transactions - List tax transactions with filters
 */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("tax:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat transaksi pajak",
    );
  }

  const tenantId = ctx.session?.user.tenantId;
  if (!tenantId) {
    return ApiErrors.badRequest("Tenant ID tidak ditemukan");
  }

  const yearParam = ctx.query.year as string | undefined;
  const monthParam = ctx.query.month as string | undefined;
  const taxTypeParam = ctx.query.taxType as string | undefined;
  const pageParam = ctx.query.page as string | undefined;
  const limitParam = ctx.query.limit as string | undefined;

  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
  const month = monthParam ? parseInt(monthParam, 10) : undefined;
  const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
  const limit = limitParam
    ? Math.min(100, Math.max(1, parseInt(limitParam, 10)))
    : 50;

  if (isNaN(year) || year < 2000 || year > 2100) {
    return ApiErrors.badRequest("Parameter year tidak valid");
  }

  const service = getTaxTransactionService();
  const result = await service.list({
    tenantId,
    year,
    month:
      month && !isNaN(month) && month >= 1 && month <= 12 ? month : undefined,
    taxType: taxTypeParam as TaxType | undefined,
    page,
    limit,
  });

  return apiSuccess(result);
});
