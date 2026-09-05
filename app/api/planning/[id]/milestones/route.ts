import { createHandler, apiSuccess, requireSessionTenantId } from "@/lib/api";
import {
  planningMilestoneService,
  bulkUpdateMilestonesSchema,
} from "@/modules/planning";

/**
 * GET /api/planning/[id]/milestones
 * Get all milestones for a planning
 */
export const GET = createHandler(
  {
    auth: true,
    permissions: ["planning:read"],
  },
  async (req, ctx) => {
    const milestones = await planningMilestoneService.getByPlanningId(
      ctx.params.id,
      requireSessionTenantId(ctx),
    );

    return apiSuccess(milestones);
  },
);

/**
 * PUT /api/planning/[id]/milestones
 * Bulk update milestones status/actualDate/notes
 */
export const PUT = createHandler(
  {
    auth: true,
    permissions: ["planning:update"],
    schema: bulkUpdateMilestonesSchema,
  },
  async (req, ctx) => {
    const milestones = await planningMilestoneService.bulkUpdate(
      ctx.params.id,
      ctx.validated.milestones,
      ctx.session!.user.id,
      requireSessionTenantId(ctx),
    );

    return apiSuccess(milestones, {
      message: "Milestones berhasil diperbarui",
    });
  },
);
