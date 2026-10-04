import { apiSuccess, createHandler } from "@/lib/api";
import { toEndorsementListItem } from "@/modules/endorsement";
import { LegalSigningService, sendForSignatureSchema } from "@/modules/legal";
import { assertAlsoPermitted, legalAccessFrom } from "../../../legal-route-helpers";

const signing = new LegalSigningService();

/**
 * POST /api/admin/legal/documents/[id]/send-for-signature — kirim berkas
 * dokumen legal (PDF) untuk ditandatangani. Butuh izin legal dan pengesahan.
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["legal:update"],
    feature: "legal",
    schema: sendForSignatureSchema,
  },
  async (_request, ctx) => {
    assertAlsoPermitted(ctx, "pengesahan:create", "Butuh izin membuat surat pengesahan");

    const result = await signing.sendForSignature(ctx.params.id as string, ctx.validated, {
      userId: ctx.session!.user.id,
      access: legalAccessFrom(ctx),
    });

    return apiSuccess({
      endorsement: toEndorsementListItem(result.endorsement),
      deliveries: result.deliveries,
      links: result.links,
    });
  },
);
