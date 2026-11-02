import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import {
  AdminUserPerformanceRouteService,
  AdminUserRouteService,
} from "@/modules/users";
import { logger } from "@/lib/logger";
import { toUserRouteApiError } from "../../user-route-error";

const adminUserRouteService = new AdminUserRouteService();

/**
 * @swagger
 * /api/admin/users/{id}/sales-performance:
 *   get:
 *     summary: Get sales performance stats
 *     description: Mengambil statistik performa sales (canvasing, points).
 *     tags: [Users]
 */
export const GET = createHandler(
  {
    auth: true,
  },
  async (req, ctx) => {
    const startTime = Date.now();
    const { session, params, query, permissions } = ctx;
    const { id: userId } = params;

    if (!userId) return ApiErrors.badRequest("Invalid User ID");
    const period = (query.period as string) || "month";

    if (!session) return ApiErrors.unauthorized();

    // Self, atau `users:read` + target di tenant & lingkup site admin.
    const access = await adminUserRouteService.checkUserReadAccess(
      session,
      userId,
      Array.isArray(permissions) ? permissions : [],
    );
    if (access.ok === false) return toUserRouteApiError(access.error);

    const userPerformanceRouteService = new AdminUserPerformanceRouteService();
    const result = await userPerformanceRouteService.getSalesPerformance(
      userId,
      period as "day" | "week" | "month" | "all",
    );
    if (!result) return ApiErrors.notFound("User");

    logger.apiRequest(
      "GET",
      `/api/admin/users/${userId}/sales-performance`,
      200,
      Date.now() - startTime,
      {
        userId: session.user.id,
        targetUserId: userId,
        period,
      },
    );

    return apiSuccess(result);
  },
);
