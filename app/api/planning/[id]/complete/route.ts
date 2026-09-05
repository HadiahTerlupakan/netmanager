import { createHandler, apiSuccess, requireSessionTenantId } from "@/lib/api";
import { planningApprovalService } from "@/modules/planning";

/**
 * POST /api/planning/[id]/complete
 * Menutup pelaksanaan rencana yang sedang berjalan.
 */
export const POST = createHandler(
  { auth: true, permissions: ["planning:update"] },
  async (_req, ctx) => {
    const result = await planningApprovalService.complete(
      ctx.params.id,
      ctx.session!.user.id,
      requireSessionTenantId(ctx),
    );

    return apiSuccess(result, { message: "Planning berhasil diselesaikan" });
  },
);
