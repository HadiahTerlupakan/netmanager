import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import {
  planningTemplateService,
  updatePlanningTemplateSchema,
} from "@/modules/planning";
import { logger } from "@/lib/logger";

/**
 * GET /api/planning/templates/[templateId]
 * Get template by ID dengan items
 */
export const GET = createHandler(
  {
    auth: true,
    permissions: ["planning.read"],
  },
  async (req, ctx) => {
    const { templateId } = ctx.params;

    const result = await planningTemplateService.getById(templateId);

    if (!result) {
      return ApiErrors.notFound("Template tidak ditemukan");
    }

    return apiSuccess(result);
  },
);

/**
 * PUT /api/planning/templates/[templateId]
 * Update template
 */
export const PUT = createHandler(
  {
    auth: true,
    permissions: ["planning.update"],
    schema: updatePlanningTemplateSchema,
  },
  async (req, ctx) => {
    const { templateId } = ctx.params;
    const userId = ctx.session!.user.id;
    const tenantId = ctx.session?.user?.tenantId;

    try {
      const result = await planningTemplateService.update(
        templateId,
        ctx.validated as Parameters<typeof planningTemplateService.update>[1],
        userId,
      );

      // Activity log
      logger.logActivity({
        action: "planning_template.updated",
        subject: "PlanningTemplate",
        details: {
          templateId,
          changes: Object.keys(ctx.validated),
        },
        userId,
        tenantId,
      });

      return apiSuccess(result, { message: "Template berhasil diperbarui" });
    } catch (error) {
      const err = error as Error;
      if (err.message.includes("not found")) {
        return ApiErrors.notFound("Template tidak ditemukan");
      }
      throw error;
    }
  },
);

/**
 * DELETE /api/planning/templates/[templateId]
 * Delete template
 */
export const DELETE = createHandler(
  {
    auth: true,
    permissions: ["planning.delete"],
  },
  async (req, ctx) => {
    const { templateId } = ctx.params;
    const userId = ctx.session!.user.id;
    const tenantId = ctx.session?.user?.tenantId;

    try {
      await planningTemplateService.delete(templateId, userId);

      // Activity log
      logger.logActivity({
        action: "planning_template.deleted",
        subject: "PlanningTemplate",
        details: { templateId },
        userId,
        tenantId,
      });

      return apiSuccess(
        { id: templateId },
        { message: "Template berhasil dihapus" },
      );
    } catch (error) {
      const err = error as Error;
      if (err.message.includes("not found")) {
        return ApiErrors.notFound("Template tidak ditemukan");
      }
      throw error;
    }
  },
);
