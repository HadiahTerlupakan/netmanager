import { NextResponse } from "next/server";
import { apiSuccess, createHandler, requireSessionTenantId } from "@/lib/api";
import {
  buildResellerReportCsv,
  buildResellerReportFilename,
  getResellerReportService,
  resellerReportQuerySchema,
} from "@/modules/reseller";

/**
 * Laporan bulanan reseller per outlet (`?period=YYYY-MM`), atau CSV dengan
 * `&format=csv`.
 */
export const GET = createHandler(
  { auth: true, permissions: ["reseller:read"], feature: "reseller" },
  async (_req, ctx) => {
    const query = resellerReportQuerySchema.parse(ctx.query);
    const report = await getResellerReportService().getMonthlyReport(
      requireSessionTenantId(ctx),
      ctx.params.id,
      query.period,
    );
    if (query.format === "json") return apiSuccess(report);
    return new NextResponse(buildResellerReportCsv(report), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${buildResellerReportFilename(report)}"`,
      },
    });
  },
);
