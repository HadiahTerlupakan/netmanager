import { NextResponse } from "next/server";
import { hasPermission } from "@/lib/rbac";
import { getTaxExportService } from "@/modules/tax";
import { ApiErrors, createHandler } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/tax/export/ppn - Export rekap PPN bulanan ke CSV
 */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("tax:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk export data pajak",
    );
  }

  const tenantId = ctx.session?.user.tenantId;
  if (!tenantId) {
    return ApiErrors.badRequest("Tenant ID tidak ditemukan");
  }

  const yearParam = ctx.query.year as string | undefined;
  const monthParam = ctx.query.month as string | undefined;

  if (!yearParam || !monthParam) {
    return ApiErrors.badRequest("Parameter year dan month wajib diisi");
  }

  const year = parseInt(yearParam, 10);
  const month = parseInt(monthParam, 10);

  if (isNaN(year) || year < 2000 || year > 2100) {
    return ApiErrors.badRequest("Parameter year tidak valid");
  }
  if (isNaN(month) || month < 1 || month > 12) {
    return ApiErrors.badRequest("Parameter month tidak valid (1-12)");
  }

  const service = getTaxExportService();
  const csv = await service.exportPpnCsv(tenantId, year, month);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rekap-ppn-${year}-${String(month).padStart(2, "0")}.csv"`,
    },
  });
});
