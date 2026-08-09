import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import {
  planningApprovalService,
  submitPlanningSchema,
} from "@/modules/planning";
import { logger } from "@/lib/logger";

/**
 * POST /api/planning/[id]/submit
 * Submit planning untuk approval
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["planning:approve_request"],
    schema: submitPlanningSchema,
  },
  async (req, ctx) => {
    const { id } = ctx.params;
    const userId = ctx.session!.user.id;
    const tenantId = ctx.session?.user?.tenantId;

    try {
      const result = await planningApprovalService.submit(id, userId);

      // Activity log
      logger.logActivity({
        action: "planning.submitted",
        subject: "Planning",
        details: {
          planningId: id,
          title: result.title,
        },
        userId,
        tenantId,
      });

      return apiSuccess(result, {
        message: "Planning berhasil diajukan untuk approval",
      });
    } catch (error) {
      const err = error as Error;
      if (err.message.includes("not found")) {
        return ApiErrors.notFound("Planning tidak ditemukan");
      }
      if (err.message.includes("cannot be submitted")) {
        return ApiErrors.badRequest(err.message);
      }
      throw error;
    }
  },
);
