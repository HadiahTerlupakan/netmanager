import { createHandler, apiSuccess, requireSessionTenantId } from "@/lib/api";
import {
  planningTemplateService,
  applyTemplateSchema,
} from "@/modules/planning";
import { logger } from "@/lib/logger";

/**
 * POST /api/planning/templates/[templateId]/apply
 * Apply template untuk membuat planning baru dengan items dari template
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["planning:create"],
    schema: applyTemplateSchema,
  },
  async (req, ctx) => {
    const { templateId } = ctx.params;
    const tenantId = requireSessionTenantId(ctx);
    const userId = ctx.session!.user.id;

    // Apply template - ini akan create planning + items dari template
    const result = await planningTemplateService.applyTemplate(
      templateId,
      {
        title: ctx.validated.title,
        description: ctx.validated.description,
        area: ctx.validated.area,
        coordinates: ctx.validated.coordinates,
        estimatedUnits: ctx.validated.estimatedUnits,
        startDate: ctx.validated.startDate,
        targetCompletionDate: ctx.validated.targetCompletionDate,
      },
      tenantId,
      userId,
    );

    // Activity log
    logger.logActivity({
      action: "planning_template.applied",
      subject: "Planning",
      details: {
        templateId,
        planningId: result.id,
        planningTitle: result.title,
        itemCount: result.items.length,
      },
      userId,
      tenantId,
    });

    return apiSuccess(result, {
      status: 201,
      message: "Template berhasil diterapkan, planning baru telah dibuat",
    });
  },
);
