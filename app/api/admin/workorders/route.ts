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
import {
  workOrderCreateSchema,
  workOrderListPaginationSchema,
} from "@/lib/validations/workorder";

/** GET /api/admin/workorders */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;

  if (!(await hasPermission("workorders:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat work order",
    );
  }

  const { searchParams } = req.nextUrl;
  // ZodError → 400 oleh createHandler; limit tanpa batas bisa memuat seluruh tabel.
  const { page, limit } = workOrderListPaginationSchema.parse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });
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
  if (!(await hasPermission("workorders:create"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk membuat work order",
    );
  }

  const body = await req.json();
  const parsed = workOrderCreateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0].message,
      ErrorCodes.VALIDATION_ERROR,
      { status: 400 },
    );
  }

  const workOrderService = getWorkOrderService();
  const result = await workOrderService.createWorkOrder(
    parsed.data,
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
