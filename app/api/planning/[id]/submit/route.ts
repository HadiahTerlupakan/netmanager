import { createHandler, apiSuccess, requireSessionTenantId } from "@/lib/api";
import {
  planningApprovalService,
  submitPlanningSchema,
} from "@/modules/planning";

/**
 * POST /api/planning/[id]/submit
 * Submit planning untuk approval.
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["planning:approve_request"],
    schema: submitPlanningSchema,
  },
  async (req, ctx) => {
    const result = await planningApprovalService.submit(
      ctx.params.id,
      ctx.session!.user.id,
      requireSessionTenantId(ctx),
    );

    return apiSuccess(result, {
      message: "Planning berhasil diajukan untuk approval",
    });
  },
);
