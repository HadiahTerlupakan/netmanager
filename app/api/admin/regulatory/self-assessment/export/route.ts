import { NextResponse } from "next/server";
import { createHandler, requireSessionTenantId } from "@/lib/api";
import { parseQuery } from "@/lib/api/query-parser";
import { buildContentDisposition } from "@/lib/utils/content-disposition";
import {
  SelfAssessmentReportService,
  buildSelfAssessmentWorkbook,
  selfAssessmentQuerySchema,
} from "@/modules/regulatory";

export const dynamic = "force-dynamic";

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const reports = new SelfAssessmentReportService();

/** GET /api/admin/regulatory/self-assessment/export?year= — berkas Excel Lampiran I + agregasi. */
export const GET = createHandler(
  { auth: true, permissions: ["regulasi:read"] },
  async (request, ctx) => {
    const { year } = selfAssessmentQuerySchema.parse(parseQuery(new URL(request.url).searchParams));
    const report = await reports.build(year, requireSessionTenantId(ctx));
    const workbook = await buildSelfAssessmentWorkbook(report);

    return new NextResponse(new Uint8Array(workbook), {
      headers: {
        "content-type": XLSX_CONTENT_TYPE,
        "content-disposition": buildContentDisposition(`self-assessment-komdigi-${year}.xlsx`),
        "cache-control": "private, no-store",
      },
    });
  },
);
