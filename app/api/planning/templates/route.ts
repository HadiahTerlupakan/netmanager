import { createHandler, apiSuccess, requireSessionTenantId } from "@/lib/api";
import {
  planningTemplateService,
  createPlanningTemplateSchema,
  listPlanningTemplateSchema,
} from "@/modules/planning";

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
      tenantId: requireSessionTenantId(ctx),
    });

    return apiSuccess({
      data: result.items,
      meta: {
        page: filters.page,
        limit: filters.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / filters.limit),
      },
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
    const tenantId = requireSessionTenantId(ctx);
    const userId = ctx.session!.user.id;

    // Activity log ditulis di service, tidak diulang di sini — sebelumnya
    // keduanya menulis dan setiap pembuatan template menghasilkan dua entri.
    const result = await planningTemplateService.create(
      ctx.validated as Parameters<typeof planningTemplateService.create>[0],
      tenantId,
      userId,
    );

    return apiSuccess(result, {
      status: 201,
      message: "Template berhasil dibuat",
    });
  },
);
