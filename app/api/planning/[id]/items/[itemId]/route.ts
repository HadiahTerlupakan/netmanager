import { createHandler, apiSuccess, requireSessionTenantId } from "@/lib/api";
import {
  planningItemService,
  updatePlanningItemSchema,
} from "@/modules/planning";

/**
 * PUT /api/planning/[id]/items/[itemId]
 * Update planning item
 */
export const PUT = createHandler(
  {
    auth: true,
    permissions: ["planning:update"],
    schema: updatePlanningItemSchema,
  },
  async (req, ctx) => {
    const { id, itemId } = ctx.params;

    const item = await planningItemService.update(
      id,
      itemId,
      ctx.validated,
      ctx.session!.user.id,
      requireSessionTenantId(ctx),
    );

    return apiSuccess(item, { message: "Item berhasil diperbarui" });
  },
);

/**
 * DELETE /api/planning/[id]/items/[itemId]
 * Delete planning item
 */
export const DELETE = createHandler(
  {
    auth: true,
    permissions: ["planning:update"],
  },
  async (req, ctx) => {
    const { id, itemId } = ctx.params;

    await planningItemService.delete(
      id,
      itemId,
      ctx.session!.user.id,
      requireSessionTenantId(ctx),
    );

    return apiSuccess({ id: itemId }, { message: "Item berhasil dihapus" });
  },
);
