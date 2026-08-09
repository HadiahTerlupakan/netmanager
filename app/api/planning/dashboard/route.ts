import { createHandler, ApiErrors } from "@/lib/api";

/**
 * GET /api/planning/dashboard
 * Get dashboard metrics untuk planning (stub - belum diimplementasi)
 */
export const GET = createHandler(
  {
    auth: true,
    permissions: ["planning.read"],
  },
  async (_req, _ctx) => {
    throw ApiErrors.notImplemented(
      "Dashboard metrics not yet implemented. Will be implemented in Task 18 with aggregated statistics and charts.",
    );
  },
);
