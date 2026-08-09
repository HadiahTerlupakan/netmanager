import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import {
  PlanningItemRepository,
  PlanningRepository,
  updatePlanningItemSchema,
  PlanningItemMapper,
} from "@/modules/planning";
import { logger } from "@/lib/logger";

const itemRepo = new PlanningItemRepository();
const planningRepo = new PlanningRepository();

/**
 * PUT /api/planning/[id]/items/[itemId]
 * Update planning item
 */
export const PUT = createHandler(
  {
    auth: true,
    permissions: ["planning.update"],
    schema: updatePlanningItemSchema,
  },
  async (req, ctx) => {
    const { id, itemId } = ctx.params;
    const userId = ctx.session!.user.id;
    const tenantId = ctx.session?.user?.tenantId;

    // Verify item exists
    const item = await itemRepo.findById(itemId);
    if (!item) {
      return ApiErrors.notFound("Item tidak ditemukan");
    }

    // Verify item belongs to this planning
    if (item.planningId !== id) {
      return ApiErrors.badRequest("Item tidak termasuk dalam planning ini");
    }

    // Verify planning exists and can be edited
    const planning = await planningRepo.findById(id);
    if (!planning) {
      return ApiErrors.notFound("Planning tidak ditemukan");
    }

    if (!planning.canBeEdited()) {
      return ApiErrors.badRequest(
        `Cannot update items in planning with status ${planning.status}. Only BACKLOG or REJECTED status can be edited.`,
      );
    }

    // Update item
    const updatedItem = await itemRepo.update(itemId, ctx.validated);

    // Activity log
    logger.logActivity({
      action: "planning.item_updated",
      subject: "PlanningItem",
      details: {
        planningId: id,
        itemId,
        changes: Object.keys(ctx.validated),
      },
      userId,
      tenantId,
    });

    // Convert to DTO
    const dto = PlanningItemMapper.toDTO(updatedItem);

    return apiSuccess(dto, { message: "Item berhasil diperbarui" });
  },
);

/**
 * DELETE /api/planning/[id]/items/[itemId]
 * Delete planning item
 */
export const DELETE = createHandler(
  {
    auth: true,
    permissions: ["planning.update"],
  },
  async (req, ctx) => {
    const { id, itemId } = ctx.params;
    const userId = ctx.session!.user.id;
    const tenantId = ctx.session?.user?.tenantId;

    // Verify item exists
    const item = await itemRepo.findById(itemId);
    if (!item) {
      return ApiErrors.notFound("Item tidak ditemukan");
    }

    // Verify item belongs to this planning
    if (item.planningId !== id) {
      return ApiErrors.badRequest("Item tidak termasuk dalam planning ini");
    }

    // Verify planning exists and can be edited
    const planning = await planningRepo.findById(id);
    if (!planning) {
      return ApiErrors.notFound("Planning tidak ditemukan");
    }

    if (!planning.canBeEdited()) {
      return ApiErrors.badRequest(
        `Cannot delete items in planning with status ${planning.status}. Only BACKLOG or REJECTED status can be edited.`,
      );
    }

    // Delete item
    await itemRepo.delete(itemId);

    // Activity log
    logger.logActivity({
      action: "planning.item_deleted",
      subject: "PlanningItem",
      details: {
        planningId: id,
        itemId,
        itemName: item.name,
      },
      userId,
      tenantId,
    });

    return apiSuccess({ id: itemId }, { message: "Item berhasil dihapus" });
  },
);
