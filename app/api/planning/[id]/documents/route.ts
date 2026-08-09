import { createHandler, ApiErrors } from "@/lib/api";

/**
 * GET /api/planning/[id]/documents
 * List documents untuk planning (stub - belum diimplementasi)
 */
export const GET = createHandler(
  {
    auth: true,
    permissions: ["planning:read"],
  },
  async (_req, _ctx) => {
    throw ApiErrors.notImplemented(
      "Document listing not yet implemented. Will be implemented in Task 14.",
    );
  },
);

/**
 * POST /api/planning/[id]/documents
 * Upload document untuk planning (stub - belum diimplementasi)
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["planning:update"],
  },
  async (_req, _ctx) => {
    throw ApiErrors.notImplemented(
      "Document upload not yet implemented. Will be implemented in Task 14 with FormData handling.",
    );
  },
);
