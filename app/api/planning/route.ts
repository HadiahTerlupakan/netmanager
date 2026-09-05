import { createHandler, apiSuccess, requireSessionTenantId } from "@/lib/api";
import {
  planningService,
  createPlanningSchema,
  listPlanningSchema,
} from "@/modules/planning";

/**
 * GET /api/planning
 * List all planning records dengan pagination dan filter
 */
export const GET = createHandler(
  {
    auth: true,
    permissions: ["planning:read"],
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
 * POST /api/planning
 * Create new planning record
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["planning:create"],
    schema: createPlanningSchema,
  },
  async (req, ctx) => {
    const tenantId = requireSessionTenantId(ctx);
    const userId = ctx.session!.user.id;

    // Activity log ditulis di service, tidak diulang di sini — sebelumnya
    // keduanya menulis dan setiap pembuatan rencana menghasilkan dua entri
    // aktivitas yang identik.
    const result = await planningService.create(
      ctx.validated,
      tenantId,
      userId,
    );

    return apiSuccess(result, {
      status: 201,
      message: "Planning berhasil dibuat",
    });
  },
);
