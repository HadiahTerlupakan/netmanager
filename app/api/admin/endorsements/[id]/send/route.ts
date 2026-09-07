import { apiSuccess, createHandler } from "@/lib/api";
import { EndorsementService } from "@/modules/endorsement";

const service = new EndorsementService();

/**
 * POST /api/admin/endorsements/[id]/send — tandai surat sudah dikirim.
 *
 * Pengiriman tautan sesungguhnya dilakukan saat surat dibuat, karena token
 * hanya ada sekali di memori dan tidak pernah tersimpan mentah.
 */
export const POST = createHandler(
  { auth: true, permissions: ["pengesahan:update"] },
  async (_request, ctx) => {
    await service.markSent(ctx.params.id as string);

    return apiSuccess({ sent: true });
  },
);
