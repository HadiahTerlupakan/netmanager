import { createHandler, apiSuccess, apiPaginated, ApiErrors } from "@/lib/api";
import {
  planningService,
  createPlanningSchema,
  listPlanningSchema,
} from "@/modules/planning";
import { logger } from "@/lib/logger";

/**
 * GET /api/planning
 * List all planning records dengan pagination dan filter
 */
export const GET = createHandler(
  {
    auth: true,
    permissions: ["planning.read"],
  },
  async (req, ctx) => {
    const { searchParams } = req.nextUrl;

    // Parse query params with Zod
    const filters = listPlanningSchema.parse({
      page: searchParams.get("page") || "1",
      limit: searchParams.get("limit") || "20",
      status: searchParams.get("status") || undefined,
      search: searchParams.get("search") || undefined,
    });

    // Call service dengan filter
    const result = await planningService.getAll({
      page: filters.page,
      limit: filters.limit,
      status: filters.status,
      search: filters.search,
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
 * POST /api/planning
 * Create new planning record
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["planning.create"],
    schema: createPlanningSchema,
  },
  async (req, ctx) => {
    const tenantId = ctx.session?.user?.tenantId;
    const userId = ctx.session!.user.id;

    if (!tenantId) {
      return ApiErrors.badRequest("Tenant ID required");
    }

    // Create planning
    const result = await planningService.create(
      ctx.validated,
      tenantId,
      userId,
    );

    // Activity log
    logger.logActivity({
      action: "planning.created",
      subject: "Planning",
      details: {
        planningId: result.id,
        title: result.title,
        type: result.type,
      },
      userId,
      tenantId,
    });

    return apiSuccess(result, {
      status: 201,
      message: "Planning berhasil dibuat",
    });
  },
);
