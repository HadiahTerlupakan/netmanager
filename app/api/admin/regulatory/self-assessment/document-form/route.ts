import { apiSuccess, createHandler, requireSessionTenantId } from "@/lib/api";
import { parseQuery } from "@/lib/api/query-parser";
import {
  SelfAssessmentDocumentService,
  selfAssessmentDocumentFormSchema,
  selfAssessmentQuerySchema,
} from "@/modules/regulatory";

export const dynamic = "force-dynamic";

const documents = new SelfAssessmentDocumentService();

const yearFrom = (request: Request) =>
  selfAssessmentQuerySchema.parse(parseQuery(new URL(request.url).searchParams)).year;

/** GET /api/admin/regulatory/self-assessment/document-form?year= — isian dokumen Word tersimpan + capaian sistem. */
export const GET = createHandler(
  { auth: true, permissions: ["regulasi:read"] },
  async (request, ctx) => apiSuccess(await documents.getForm(yearFrom(request), requireSessionTenantId(ctx))),
);

/** PUT /api/admin/regulatory/self-assessment/document-form?year= — simpan profil penyelenggara & isian tahun itu. */
export const PUT = createHandler(
  { auth: true, permissions: ["regulasi:update"], schema: selfAssessmentDocumentFormSchema },
  async (request, ctx) => {
    await documents.saveForm(yearFrom(request), requireSessionTenantId(ctx), ctx.validated);
    return apiSuccess({ saved: true });
  },
);
