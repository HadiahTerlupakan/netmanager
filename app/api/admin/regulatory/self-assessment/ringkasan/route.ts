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

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const reports = new SelfAssessmentReportService();

/**
 * GET /api/admin/regulatory/self-assessment/ringkasan — berkas kerja internal.
 *
 * Berbeda dari `/export`, yang menghasilkan Lampiran I sesuai format Komdigi.
 * Berkas ini memuat agregasi bulanan/kuartalan/tahunan dan rincian per
 * kabupaten/kota untuk ditelaah sendiri — **bukan** untuk dikirim ke regulator.
 * Namanya dibedakan tegas supaya tidak tertukar saat pelaporan.
 */
export const GET = createHandler(
  { auth: true, permissions: ["regulasi:read"] },
  async (request, ctx) => {
    const { year, skema, siteIds } = selfAssessmentQuerySchema.parse(
      parseQuery(new URL(request.url).searchParams),
    );
    const report = await reports.build(
      year,
      requireSessionTenantId(ctx),
      skema,
      siteIds,
    );
    const workbook = await buildSelfAssessmentWorkbook(report);

    return new NextResponse(new Uint8Array(workbook), {
      headers: {
        "content-type": XLSX_CONTENT_TYPE,
        "content-disposition": buildContentDisposition(
          `ringkasan-internal-self-assessment-${skema.toLowerCase()}-${year}.xlsx`,
        ),
        "cache-control": "private, no-store",
      },
    });
  },
);
