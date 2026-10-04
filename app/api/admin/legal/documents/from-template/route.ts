import { apiSuccess, createHandler } from "@/lib/api";
import {
  createDocumentFromTemplateSchema,
  LegalTemplateDocumentService,
  toLegalDocumentDetail,
} from "@/modules/legal";
import { legalAccessFrom } from "../../legal-route-helpers";

const templateDocuments = new LegalTemplateDocumentService();

/** POST /api/admin/legal/documents/from-template — susun PDF dari template lalu catat sebagai dokumen. */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["legal:create"],
    feature: "legal",
    schema: createDocumentFromTemplateSchema,
  },
  async (_request, ctx) => {
    const document = await templateDocuments.createDocument(
      ctx.validated.content,
      ctx.validated.document,
      { userId: ctx.session!.user.id, access: legalAccessFrom(ctx) },
    );

    return apiSuccess(toLegalDocumentDetail(document));
  },
);
