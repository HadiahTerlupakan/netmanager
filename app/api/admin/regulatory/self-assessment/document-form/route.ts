import { apiSuccess, createHandler, requireSessionTenantId } from "@/lib/api";
import { parseQuery } from "@/lib/api/query-parser";
import {
  SelfAssessmentDocumentService,
  selfAssessmentDocumentFormSchema,
  selfAssessmentQuerySchema,
  pastikanKunciSesuaiSkema,
} from "@/modules/regulatory";

export const dynamic = "force-dynamic";

const documents = new SelfAssessmentDocumentService();

const paramsFrom = (request: Request) =>
  selfAssessmentQuerySchema.parse(
    parseQuery(new URL(request.url).searchParams),
  );

/** GET /api/admin/regulatory/self-assessment/document-form?year= — isian dokumen Word tersimpan + capaian sistem. */
export const GET = createHandler(
  { auth: true, permissions: ["regulasi:read"] },
  async (request, ctx) => {
    const { year, skema } = paramsFrom(request);
    return apiSuccess(
      await documents.getForm(year, requireSessionTenantId(ctx), skema),
    );
  },
);

/** PUT /api/admin/regulatory/self-assessment/document-form?year= — simpan profil penyelenggara & isian tahun itu. */
export const PUT = createHandler(
  {
    auth: true,
    permissions: ["regulasi:update"],
    schema: selfAssessmentDocumentFormSchema,
  },
  async (request, ctx) => {
    const { year, skema } = paramsFrom(request);
    pastikanKunciSesuaiSkema(skema, ctx.validated.yearly);
    await documents.saveForm(
      year,
      requireSessionTenantId(ctx),
      skema,
      ctx.validated,
    );
    return apiSuccess({ saved: true });
  },
);
