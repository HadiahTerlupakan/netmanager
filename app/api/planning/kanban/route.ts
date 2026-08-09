import { createHandler, apiSuccess } from "@/lib/api";
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

    const board = await planningKanbanService.getKanbanBoard(
      ctx.session.user.tenantId,
      { search },
    );

    return apiSuccess(board);
  },
);
