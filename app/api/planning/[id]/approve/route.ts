import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import {
  planningApprovalService,
  approvePlanningSchema,
} from "@/modules/planning";
import { logger } from "@/lib/logger";

/**
 * POST /api/planning/[id]/approve
 * Approve planning (level 1 atau level 2)
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["planning.approve"],
    schema: approvePlanningSchema,
  },
  async (req, ctx) => {
    const { id } = ctx.params;
    const userId = ctx.session!.user.id;
    const tenantId = ctx.session?.user?.tenantId;

    try {
      const result = await planningApprovalService.approve(
        id,
        userId,
        ctx.validated.approvalNotes,
      );

      // Activity log
      logger.logActivity({
        action: "planning.approved",
        subject: "Planning",
        details: {
          planningId: id,
          title: result.title,
          status: result.status,
        },
        userId,
        tenantId,
      });

      return apiSuccess(result, { message: "Planning berhasil disetujui" });
    } catch (error) {
      const err = error as Error;
      if (err.message.includes("not found")) {
        return ApiErrors.notFound("Planning tidak ditemukan");
      }
      if (err.message.includes("cannot be approved")) {
        return ApiErrors.badRequest(err.message);
      }
      throw error;
    }
  },
);
