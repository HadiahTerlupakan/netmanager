import { apiSuccess, createHandler } from "@/lib/api";
import { EndorsementIssueService } from "@/modules/endorsement";

const issuer = new EndorsementIssueService();

/**
 * POST /api/admin/endorsements/[id]/signers/[signerId]/reissue
 *
 * Terbitkan tautan baru untuk satu penanda tangan dan kirimkan lagi. Tautan
 * lama langsung tidak berlaku. URL dikembalikan supaya admin bisa
 * meneruskannya manual bila kanal otomatis gagal.
 */
export const POST = createHandler(
  { auth: true, permissions: ["pengesahan:update"] },
  async (_request, ctx) => {
    const result = await issuer.reissue(
      ctx.params.id as string,
      ctx.params.signerId as string,
    );

    return apiSuccess(result);
  },
);
