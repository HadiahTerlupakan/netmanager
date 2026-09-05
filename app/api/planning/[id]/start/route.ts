import { createHandler, apiSuccess, requireSessionTenantId } from "@/lib/api";
import { planningApprovalService } from "@/modules/planning";

/**
 * POST /api/planning/[id]/start
 * Transisi pelaksanaan dari status APPROVED.
 *
 * Gerbang `planning:update` disamakan dengan hak mengedit rencana. Bila
 * organisasi memerlukan peran lapangan terpisah untuk menandai mulai/selesai,
 * permission inilah yang perlu diganti.
 */
export const POST = createHandler(
  { auth: true, permissions: ["planning:update"] },
  async (_req, ctx) => {
    const result = await planningApprovalService.startProgress(
      ctx.params.id,
      ctx.session!.user.id,
      requireSessionTenantId(ctx),
    );

    return apiSuccess(result, { message: "Planning berhasil dimulai" });
  },
);
