import { adminWorkOrderRouteService } from "@/modules/work-order";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";

/** GET /api/admin/workorders/top-performers */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("work_order_dashboard:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat top performers",
    );
  }

  const result = await adminWorkOrderRouteService.getTopPerformers({
    period: req.nextUrl.searchParams.get("period") || "all_time",
    user: ctx.session!.user,
    permissions: ctx.permissions,
  });

  if (!result.success) {
    return ApiErrors.unauthorized();
  }

  return apiSuccess({
    performers: result.data.performers,
    topAssists: result.data.topAssists,
  });
});
