import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { planningApprovalService } from "@/modules/planning";
import { logger } from "@/lib/logger";

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
    const { id } = ctx.params;
    const userId = ctx.session!.user.id;
    const tenantId = ctx.session?.user?.tenantId;

    try {
      const result = await planningApprovalService.startProgress(id, userId);

      logger.logActivity({
        action: "planning.started",
        subject: "Planning",
        details: { planningId: id, title: result.title },
        userId,
        tenantId,
      });

      return apiSuccess(result, { message: "Planning berhasil dimulai" });
    } catch (error) {
      const err = error as Error;
      if (err.message.includes("not found")) {
        return ApiErrors.notFound("Planning tidak ditemukan");
      }
      if (err.message.includes("cannot be")) {
        return ApiErrors.badRequest(err.message);
      }
      throw error;
    }
  },
);
