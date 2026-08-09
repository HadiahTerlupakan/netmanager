import { createHandler, ApiErrors } from "@/lib/api";

/**
 * GET /api/planning/[id]/export
 * Export planning to PDF (stub - belum diimplementasi)
 */
export const GET = createHandler(
  {
    auth: true,
    permissions: ["planning:read"],
  },
  async (_req, _ctx) => {
    throw ApiErrors.notImplemented(
      "PDF export not yet implemented. Will be implemented in Task 26 with PDF generation library.",
    );
  },
);
