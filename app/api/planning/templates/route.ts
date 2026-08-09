import { createHandler, apiSuccess, apiPaginated, ApiErrors } from "@/lib/api";
import {
  planningTemplateService,
  createPlanningTemplateSchema,
  listPlanningTemplateSchema,
} from "@/modules/planning";
import { logger } from "@/lib/logger";

/**
 * GET /api/planning/templates
 * List all templates dengan pagination dan filter
 */
export const GET = createHandler(
  {
    auth: true,
    permissions: ["planning:read"],
  },
  async (req, ctx) => {
    const { searchParams } = req.nextUrl;

    // Parse query params with Zod
    const filters = listPlanningTemplateSchema.parse({
      page: searchParams.get("page") || "1",
      limit: searchParams.get("limit") || "20",
      type: searchParams.get("type") || undefined,
      isActive: searchParams.get("isActive") || undefined,
    });

    // Call service
    const result = await planningTemplateService.getAll({
      page: filters.page,
      limit: filters.limit,
      type: filters.type,
      isActive: filters.isActive,
      tenantId: ctx.session?.user?.tenantId || undefined,
    });

    return apiPaginated(result.items, {
      page: filters.page,
      limit: filters.limit,
      total: result.total,
    });
  },
);

/**
 * POST /api/planning/templates
 * Create new template
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["planning:create"],
    schema: createPlanningTemplateSchema,
  },
  async (req, ctx) => {
    const tenantId = ctx.session?.user?.tenantId;
    const userId = ctx.session!.user.id;

    if (!tenantId) {
      return ApiErrors.badRequest("Tenant ID required");
    }

    // Create template
    const result = await planningTemplateService.create(
      ctx.validated as Parameters<typeof planningTemplateService.create>[0],
      tenantId,
      userId,
    );

    // Activity log
    logger.logActivity({
      action: "planning_template.created",
      subject: "PlanningTemplate",
      details: {
        templateId: result.id,
        name: result.name,
        itemCount: result.items.length,
      },
      userId,
      tenantId,
    });

    return apiSuccess(result, {
      status: 201,
      message: "Template berhasil dibuat",
    });
  },
);
