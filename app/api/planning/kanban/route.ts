import { createHandler, ApiErrors } from "@/lib/api";

/**
 * GET /api/planning/kanban
 * Get kanban board view untuk planning (stub - belum diimplementasi)
 */
export const GET = createHandler(
  {
    auth: true,
    permissions: ["planning.read"],
  },
  async (_req, _ctx) => {
    throw ApiErrors.notImplemented(
      "Kanban board not yet implemented. Will be implemented in Task 18 with status grouping and drag-drop logic.",
    );
  },
);
