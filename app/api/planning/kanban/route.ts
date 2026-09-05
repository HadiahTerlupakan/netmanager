import { createHandler, apiSuccess, requireSessionTenantId } from "@/lib/api";
import { planningKanbanService } from "@/modules/planning";

/**
 * GET /api/planning/kanban
 * Get kanban board view untuk planning dengan grouping by status
 */
export const GET = createHandler(
  {
    auth: true,
    permissions: ["planning:read"],
  },
  async (req, ctx) => {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || undefined;

    // Lihat catatan tenant di route dashboard.
    const board = await planningKanbanService.getKanbanBoard(
      requireSessionTenantId(ctx),
      { search },
    );

    return apiSuccess(board);
  },
);
