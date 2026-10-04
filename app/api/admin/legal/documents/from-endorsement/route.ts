import { apiSuccess, createHandler } from "@/lib/api";
import {
  archiveEndorsementSchema,
  LegalSigningService,
  toLegalDocumentDetail,
} from "@/modules/legal";
import { assertAlsoPermitted, legalAccessFrom } from "../../legal-route-helpers";

const signing = new LegalSigningService();

/** POST /api/admin/legal/documents/from-endorsement — arsipkan surat pengesahan yang sudah sah. */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["legal:create"],
    feature: "legal",
    schema: archiveEndorsementSchema,
  },
  async (_request, ctx) => {
    assertAlsoPermitted(ctx, "pengesahan:read", "Butuh izin membaca surat pengesahan");
    const { endorsementId, ...payload } = ctx.validated;

    const document = await signing.archiveEndorsement(endorsementId, payload, {
      userId: ctx.session!.user.id,
      access: legalAccessFrom(ctx),
    });

    return apiSuccess(toLegalDocumentDetail(document));
  },
);
