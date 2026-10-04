import { apiSuccess, createHandler } from "@/lib/api";
import {
  LegalDocumentService,
  toLegalDocumentDetail,
  updateLegalDocumentSchema,
} from "@/modules/legal";
import { legalAccessFrom } from "../../legal-route-helpers";

const documents = new LegalDocumentService();

/** GET /api/admin/legal/documents/[id] — detail beserta tenggat dan kewajiban. */
export const GET = createHandler(
  { auth: true, permissions: ["legal:read"], feature: "legal" },
  async (_request, ctx) => {
    const document = await documents.getById(ctx.params.id as string, legalAccessFrom(ctx));

    return apiSuccess(toLegalDocumentDetail(document));
  },
);

/** PATCH /api/admin/legal/documents/[id] — ubah data; kewajiban diganti utuh bila dikirim. */
export const PATCH = createHandler(
  {
    auth: true,
    permissions: ["legal:update"],
    feature: "legal",
    schema: updateLegalDocumentSchema,
  },
  async (_request, ctx) => {
    const document = await documents.update(
      ctx.params.id as string,
      ctx.validated,
      legalAccessFrom(ctx),
    );

    return apiSuccess(toLegalDocumentDetail(document));
  },
);
