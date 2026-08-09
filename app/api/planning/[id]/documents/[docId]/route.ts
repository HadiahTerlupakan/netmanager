import { createHandler, ApiErrors } from "@/lib/api";

/**
 * DELETE /api/planning/[id]/documents/[docId]
 * Delete document dari planning (stub - belum diimplementasi)
 */
export const DELETE = createHandler(
  {
    auth: true,
    permissions: ["planning:update"],
  },
  async (_req, _ctx) => {
    throw ApiErrors.notImplemented(
      "Document deletion not yet implemented. Will be implemented in Task 14.",
    );
  },
);
