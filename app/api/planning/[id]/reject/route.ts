import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import {
  planningApprovalService,
  rejectPlanningSchema,
} from "@/modules/planning";
import { logger } from "@/lib/logger";

/**
 * POST /api/planning/[id]/reject
 * Reject planning dengan alasan
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["planning:approve"],
    schema: rejectPlanningSchema,
  },
  async (req, ctx) => {
    const { id } = ctx.params;
    const userId = ctx.session!.user.id;
    const tenantId = ctx.session?.user?.tenantId;

    try {
      const result = await planningApprovalService.reject(
        id,
        userId,
        ctx.validated.approvalNotes,
      );

      // Activity log
      logger.logActivity({
        action: "planning.rejected",
        subject: "Planning",
        details: {
          planningId: id,
          title: result.title,
          reason: ctx.validated.approvalNotes,
        },
        userId,
        tenantId,
      });

      return apiSuccess(result, { message: "Planning berhasil ditolak" });
    } catch (error) {
      const err = error as Error;
      if (err.message.includes("not found")) {
        return ApiErrors.notFound("Planning tidak ditemukan");
      }
      if (err.message.includes("cannot be rejected")) {
        return ApiErrors.badRequest(err.message);
      }
      throw error;
    }
  },
);
