import {
  getWorkOrderService,
  adminWorkOrderRouteService,
} from "@/modules/work-order";
import { hasPermission } from "@/lib/rbac";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";

/** Build work order list filters from query params. */
function buildFilters(searchParams: URLSearchParams) {
  const filters: Record<string, string | string[] | boolean> = {};
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const type = searchParams.get("type");
  const departmentId = searchParams.get("departmentId");
  const siteId = searchParams.get("siteId");
  const assignedToId = searchParams.get("assignedToId");
  const search = searchParams.get("search");
  const unassignedOnly = searchParams.get("unassignedOnly") === "true";
  const woType = searchParams.get("woType");

  if (status)
    filters.status = status.includes(",") ? status.split(",") : status;
  if (priority)
    filters.priority = priority.includes(",") ? priority.split(",") : priority;
  if (type) filters.type = type.includes(",") ? type.split(",") : type;
  if (departmentId) filters.departmentId = departmentId;
  if (siteId) filters.siteId = siteId;
  if (assignedToId) filters.assignedToId = assignedToId;
  if (search) filters.search = search;
  if (unassignedOnly) filters.unassignedOnly = true;
  if (woType === "customer") filters.isInternal = false;
  if (woType === "internal") filters.isInternal = true;

  return filters;
}

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
  const access = await adminWorkOrderRouteService.buildAccessFilters(
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
    filters: buildFilters(searchParams),
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
