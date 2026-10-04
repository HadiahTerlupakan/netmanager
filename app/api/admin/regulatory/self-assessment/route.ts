import { apiSuccess, createHandler, requireSessionTenantId } from "@/lib/api";
import { parseQuery } from "@/lib/api/query-parser";
import {
  SelfAssessmentReportService,
  selfAssessmentQuerySchema,
  toSelfAssessmentSummary,
} from "@/modules/regulatory";

export const dynamic = "force-dynamic";

const reports = new SelfAssessmentReportService();

/** GET /api/admin/regulatory/self-assessment?year= — ringkasan Self-Assessment Komdigi satu tahun. */
export const GET = createHandler(
  { auth: true, permissions: ["regulasi:read"] },
  async (request, ctx) => {
    const { year } = selfAssessmentQuerySchema.parse(parseQuery(new URL(request.url).searchParams));
    const report = await reports.build(year, requireSessionTenantId(ctx));

    return apiSuccess(toSelfAssessmentSummary(report));
  },
);
