import { apiSuccess, createHandler } from "@/lib/api";
import { LegalSigningService } from "@/modules/legal";

const signing = new LegalSigningService();

/** GET /api/admin/legal/documents/by-endorsement/[endorsementId] — dokumen legal yang mengarsipkan surat ini. */
export const GET = createHandler(
  { auth: true, permissions: ["legal:read"], feature: "legal" },
  async (_request, ctx) => {
    const documentId = await signing.findArchivedDocumentId(ctx.params.endorsementId as string);

    return apiSuccess({ documentId });
  },
);
