import { NextResponse } from "next/server";
import { hasPermission } from "@/lib/rbac";
import { getTaxExportService } from "@/modules/tax";
import { ApiErrors, createHandler } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/tax/export/bhp-uso - Export rekap BHP/USO tahunan ke CSV
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

  if (!yearParam) {
    return ApiErrors.badRequest("Parameter year wajib diisi");
  }

  const year = parseInt(yearParam, 10);

  if (isNaN(year) || year < 2000 || year > 2100) {
    return ApiErrors.badRequest("Parameter year tidak valid");
  }

  const service = getTaxExportService();
  const csv = await service.exportBhpUsoCsv(tenantId, year);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rekap-bhp-uso-${year}.csv"`,
    },
  });
});
