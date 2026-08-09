import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { planningService, updatePlanningSchema } from "@/modules/planning";
import { logger } from "@/lib/logger";

/**
 * GET /api/planning/[id]
 * Get planning by ID dengan relasi lengkap
 */
export const GET = createHandler(
  {
    auth: true,
    permissions: ["planning.read"],
  },
  async (req, ctx) => {
    const { id } = ctx.params;

    const result = await planningService.getById(id);

    if (!result) {
      return ApiErrors.notFound("Planning tidak ditemukan");
    }

    return apiSuccess(result);
  },
);

/**
 * PUT /api/planning/[id]
 * Update planning data
 */
export const PUT = createHandler(
  {
    auth: true,
    permissions: ["planning.update"],
    schema: updatePlanningSchema,
  },
  async (req, ctx) => {
    const { id } = ctx.params;
    const userId = ctx.session!.user.id;
    const tenantId = ctx.session?.user?.tenantId;

    try {
      const result = await planningService.update(id, ctx.validated, userId);

      // Activity log
      logger.logActivity({
        action: "planning.updated",
        subject: "Planning",
        details: {
          planningId: id,
          changes: Object.keys(ctx.validated),
        },
        userId,
        tenantId,
      });

      return apiSuccess(result, { message: "Planning berhasil diperbarui" });
    } catch (error) {
      const err = error as Error;
      if (err.message.includes("not found")) {
        return ApiErrors.notFound("Planning tidak ditemukan");
      }
      if (err.message.includes("cannot be edited")) {
        return ApiErrors.badRequest(err.message);
      }
      throw error;
    }
  },
);

/**
 * DELETE /api/planning/[id]
 * Soft delete planning
 */
export const DELETE = createHandler(
  {
    auth: true,
    permissions: ["planning.delete"],
  },
  async (req, ctx) => {
    const { id } = ctx.params;
    const userId = ctx.session!.user.id;
    const tenantId = ctx.session?.user?.tenantId;

    try {
      await planningService.delete(id, userId);

      // Activity log
      logger.logActivity({
        action: "planning.deleted",
        subject: "Planning",
        details: { planningId: id },
        userId,
        tenantId,
      });

      return apiSuccess({ id }, { message: "Planning berhasil dihapus" });
    } catch (error) {
      const err = error as Error;
      if (err.message.includes("not found")) {
        return ApiErrors.notFound("Planning tidak ditemukan");
      }
      if (err.message.includes("cannot be deleted")) {
        return ApiErrors.badRequest(err.message);
      }
      throw error;
    }
  },
);
