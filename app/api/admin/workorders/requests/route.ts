import {
  getWorkOrderService,
  getAdminWorkOrderRouteService,
} from "@/modules/work-order";
import { hasPermission } from "@/lib/rbac";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth";

/** GET /api/admin/workorders/requests */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;

  if (!(await hasPermission("workorders:requests:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat permintaan work order",
    );
  }

  const page = Number.parseInt(req.nextUrl.searchParams.get("page") || "1", 10);
  const limit = Number.parseInt(
    req.nextUrl.searchParams.get("limit") || "20",
    10,
  );
  const search = req.nextUrl.searchParams.get("search") || undefined;
  const departmentId =
    req.nextUrl.searchParams.get("departmentId") || undefined;
  const siteId = req.nextUrl.searchParams.get("siteId") || undefined;
  const access = await getAdminWorkOrderRouteService().buildAccessFilters(
    user,
    ctx.permissions,
  );

  if (access.unauthorized) {
    return ApiErrors.unauthorized();
  }

  const isSuper = isSuperAdmin({ role: user.role });
  const filters: { departmentId?: string; siteId?: string; search?: string } = {
    ...(search ? { search } : {}),
  };

  if (
    access.userSiteId &&
    !isSuper &&
    (ctx.permissions || []).includes("workorders:site_only")
  ) {
    filters.siteId = access.userSiteId;
  } else if (siteId) {
    filters.siteId = siteId;
  }

  if (
    access.userDepartmentId &&
    !isSuper &&
    (ctx.permissions || []).includes("workorders:department_only")
  ) {
    filters.departmentId = access.userDepartmentId;
  } else if (departmentId) {
    filters.departmentId = departmentId;
  }

  const result = await getWorkOrderService().getWorkOrderRequests(
    filters,
    page,
    limit,
  );

  if (!result.success) {
    return apiError(
      result.error || "Gagal mengambil permintaan work order",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }

  return apiSuccess({
    data: result.data?.workOrders || [],
    pagination: {
      page: result.data?.page || page,
      totalPages: result.data?.totalPages || 1,
      total: result.data?.total || 0,
    },
    pendingCount: result.data?.total || 0,
  });
});
