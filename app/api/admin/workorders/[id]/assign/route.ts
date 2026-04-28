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

/** POST /api/admin/workorders/[id]/assign */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("list:update"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk assign work order",
    );
  }

  const userContext = await getAdminWorkOrderRouteService().getUserContext(
    ctx.session!.user,
    ctx.permissions,
  );

  if (!userContext) {
    return ApiErrors.unauthorized();
  }

  const getResult = await getWorkOrderService().getWorkOrderById(
    ctx.params.id,
    userContext,
  );

  if (!getResult.success) {
    if (getResult.code === "FORBIDDEN") {
      return ApiErrors.forbidden(getResult.error || "Akses ditolak");
    }

    return ApiErrors.notFound("Work Order");
  }

  const body = await req.json();

  if (!body.employeeId) {
    return apiError("Employee ID wajib diisi", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
    });
  }

  const result = await getWorkOrderService().assignWorkOrder(
    ctx.params.id,
    body.employeeId,
    userContext,
    body.role,
  );

  if (!result.success) {
    return apiError(
      result.error || "Gagal assign work order",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }

  return apiSuccess(result.data, { message: "Work order berhasil di-assign" });
});
