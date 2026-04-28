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

/** GET /api/admin/workorders */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;

  if (!(await hasPermission("list:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat work order",
    );
  }

  const { searchParams } = req.nextUrl;
  const page = Number.parseInt(searchParams.get("page") || "1", 10);
  const limit = Number.parseInt(searchParams.get("limit") || "20", 10);
  const access = await getAdminWorkOrderRouteService().buildAccessFilters(
    user,
    ctx.permissions,
  );

  if (access.unauthorized) {
    return ApiErrors.unauthorized("User tidak valid");
  }

  const workOrderService = getWorkOrderService();
  const result = await workOrderService.getWorkOrders({
    page,
    limit,
    filters: getAdminWorkOrderRouteService().buildListFilters(searchParams),
    userId: user.id,
    userPermissions: ctx.permissions || [],
    userDepartmentId: access.userDepartmentId,
    userSiteId: access.userSiteId,
    userRole: user.role,
  });

  if (!result.success) {
    return apiError(
      result.error || "Gagal mengambil work order",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }

  return apiSuccess(result.data);
});

/** POST /api/admin/workorders */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("list:create"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk membuat work order",
    );
  }

  const body = await req.json();
  const workOrderService = getWorkOrderService();
  const result = await workOrderService.createWorkOrder(
    body,
    ctx.session!.user,
  );

  if (!result.success) {
    if (result.code === "FORBIDDEN") {
      return apiError(result.error || "Akses ditolak", ErrorCodes.FORBIDDEN, {
        status: 403,
      });
    }

    if (result.code === "VALIDATION_ERROR") {
      return apiError(
        result.error || "Data tidak valid",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    return apiError(
      result.error || "Gagal membuat work order",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }

  return apiSuccess(result.data, {
    status: 201,
    message: "Work order berhasil dibuat",
  });
});
