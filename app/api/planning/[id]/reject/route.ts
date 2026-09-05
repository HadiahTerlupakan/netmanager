import { createHandler, apiSuccess, requireSessionTenantId } from "@/lib/api";
import {
  planningApprovalService,
  rejectPlanningSchema,
} from "@/modules/planning";

/**
 * POST /api/planning/[id]/reject
 * Reject planning dengan alasan wajib.
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["planning:approve"],
    schema: rejectPlanningSchema,
  },
  async (req, ctx) => {
    const result = await planningApprovalService.reject(
      ctx.params.id,
      ctx.session!.user.id,
      requireSessionTenantId(ctx),
      ctx.validated.approvalNotes,
    );

    return apiSuccess(result, { message: "Planning berhasil ditolak" });
  },
);
