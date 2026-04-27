import { adminWorkOrderRouteService } from "@/modules/work-order";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";

/** GET /api/admin/workorders/response-stats */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("work_order_dashboard:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat statistik response",
    );
  }

  const result = await adminWorkOrderRouteService.getResponseStats({
    period: req.nextUrl.searchParams.get("period") || "last_30_days",
    user: ctx.session!.user,
    permissions: ctx.permissions,
  });

  if (!result.success) {
    return ApiErrors.unauthorized();
  }

  return apiSuccess(result.data);
});
