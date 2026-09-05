import { createHandler, apiSuccess, requireSessionTenantId } from "@/lib/api";
import {
  planningItemService,
  createPlanningItemSchema,
} from "@/modules/planning";

/**
 * GET /api/planning/[id]/items
 * List all items for a planning
 */
export const GET = createHandler(
  {
    auth: true,
    permissions: ["planning:read"],
  },
  async (req, ctx) => {
    const items = await planningItemService.getByPlanningId(
      ctx.params.id,
      requireSessionTenantId(ctx),
    );

    return apiSuccess(items);
  },
);

/**
 * POST /api/planning/[id]/items
 * Add new item to planning.
 *
 * Aturan "hanya BACKLOG/REJECTED yang boleh diubah", pemeriksaan kepemilikan,
 * penulisan audit, dan activity log semuanya ada di `PlanningItemService` —
 * sebelumnya semua itu berada di route ini, dan auditnya tidak ada sama sekali.
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["planning:update"],
    schema: createPlanningItemSchema,
  },
  async (req, ctx) => {
    const item = await planningItemService.create(
      ctx.params.id,
      ctx.validated,
      ctx.session!.user.id,
      requireSessionTenantId(ctx),
    );

    return apiSuccess(item, {
      status: 201,
      message: "Item berhasil ditambahkan",
    });
  },
);
