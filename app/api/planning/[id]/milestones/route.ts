import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import {
  getPlanningMilestoneRepository,
  getPlanningRepository,
  bulkUpdateMilestonesSchema,
  PlanningMilestoneMapper,
} from "@/modules/planning";
import type { UpdatePlanningMilestoneInput } from "@/modules/planning";
import { logger } from "@/lib/logger";

const milestoneRepo = getPlanningMilestoneRepository();
const planningRepo = getPlanningRepository();

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
    const { id } = ctx.params;

    // Verify planning exists
    const planning = await planningRepo.findById(id);
    if (!planning) {
      return ApiErrors.notFound("Planning tidak ditemukan");
    }

    // Get all milestones
    const milestones = await milestoneRepo.findByPlanningId(id);

    // Convert to DTOs
    const dtos = milestones.map((m) => PlanningMilestoneMapper.toDTO(m));

    return apiSuccess(dtos);
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
    const { id } = ctx.params;
    const userId = ctx.session!.user.id;
    const tenantId = ctx.session?.user?.tenantId;

    // Verify planning exists
    const planning = await planningRepo.findById(id);
    if (!planning) {
      return ApiErrors.notFound("Planning tidak ditemukan");
    }

    // Bulk update milestones
    const updatePromises = ctx.validated.milestones.map(
      async (milestoneUpdate) => {
        const milestone = await milestoneRepo.findById(milestoneUpdate.id);

        if (!milestone) {
          throw new Error(`Milestone with ID ${milestoneUpdate.id} not found`);
        }

        if (milestone.planningId !== id) {
          throw new Error(
            `Milestone ${milestoneUpdate.id} does not belong to planning ${id}`,
          );
        }

        const updateData: UpdatePlanningMilestoneInput = {};

        if (milestoneUpdate.status !== undefined) {
          updateData.status = milestoneUpdate.status;
        }
        if (milestoneUpdate.actualDate !== undefined) {
          updateData.actualDate = milestoneUpdate.actualDate
            ? new Date(milestoneUpdate.actualDate)
            : null;
        }
        if (milestoneUpdate.notes !== undefined) {
          updateData.notes = milestoneUpdate.notes;
        }

        return milestoneRepo.update(milestoneUpdate.id, updateData);
      },
    );

    try {
      const updatedMilestones = await Promise.all(updatePromises);

      // Activity log
      logger.logActivity({
        action: "planning.milestones_updated",
        subject: "PlanningMilestone",
        details: {
          planningId: id,
          updatedCount: updatedMilestones.length,
          milestoneIds: ctx.validated.milestones.map((m) => m.id),
        },
        userId,
        tenantId,
      });

      // Convert to DTOs
      const dtos = updatedMilestones.map((m) =>
        PlanningMilestoneMapper.toDTO(m),
      );

      return apiSuccess(dtos, { message: "Milestones berhasil diperbarui" });
    } catch (error) {
      const err = error as Error;
      if (err.message.includes("not found")) {
        return ApiErrors.notFound(err.message);
      }
      if (err.message.includes("does not belong")) {
        return ApiErrors.badRequest(err.message);
      }
      throw error;
    }
  },
);
