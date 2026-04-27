import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { AdminUserPerformanceRouteService } from "@/modules/users";
import { logger } from "@/lib/logger";

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

    // Authorization: Self OR users:read permission
    const isSelf = session.user.id === userId;
    const hasReadPermission =
      permissions.includes("users:read") || permissions.includes("*");

    if (!isSelf && !hasReadPermission) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk melihat performa sales user ini",
      );
    }

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
