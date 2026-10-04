import { apiSuccess, createHandler } from "@/lib/api";
import { LegalDocumentService, terminateLegalDocumentSchema } from "@/modules/legal";
import { legalAccessFrom } from "../../../legal-route-helpers";

const documents = new LegalDocumentService();

/** POST /api/admin/legal/documents/[id]/terminate — akhiri dokumen; pengingatnya berhenti. */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["legal:update"],
    feature: "legal",
    schema: terminateLegalDocumentSchema,
  },
  async (_request, ctx) => {
    await documents.terminate(
      ctx.params.id as string,
      ctx.validated.reason,
      legalAccessFrom(ctx),
    );

    return apiSuccess({ terminated: true });
  },
);
