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
 * /api/admin/users/{id}/performance:
 *   get:
 *     summary: Get user performance stats
 *     description: Mengambil statistik performa user (kehadiran, cuti, work order).
 *     tags: [Users]
 */
export const GET = createHandler(
  {
    auth: true,
  },
  async (req, ctx) => {
    const startTime = Date.now();
    const { session, params, permissions } = ctx;
    const { id: userId } = params;

    if (!userId) return ApiErrors.badRequest("Invalid User ID");

    if (!session) return ApiErrors.unauthorized();

    // Self, atau `users:read` + target di tenant & lingkup site admin.
    const access = await adminUserRouteService.checkUserReadAccess(
      session,
      userId,
      Array.isArray(permissions) ? permissions : [],
    );
    if (access.ok === false) return toUserRouteApiError(access.error);

    const { searchParams } = new URL(req.url);
    const userPerformanceRouteService = new AdminUserPerformanceRouteService();
    const result = await userPerformanceRouteService.getUserPerformance(
      userId,
      {
        dateFrom: searchParams.get("dateFrom"),
        dateTo: searchParams.get("dateTo"),
        period: searchParams.get("period") || "month",
      },
    );
    if (!result) return ApiErrors.notFound("User");

    logger.apiRequest(
      "GET",
      `/api/admin/users/${userId}/performance`,
      200,
      Date.now() - startTime,
      {
        userId: session.user.id,
        targetUserId: userId,
      },
    );

    return apiSuccess(result);
  },
);
