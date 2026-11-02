import { hasPermission } from "@/lib/rbac";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";
import { getAdminWorkOrderRouteService } from "@/modules/work-order";

/** GET /api/admin/workorders/[id]/material-detail */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("workorders:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat work order",
    );
  }

  const updateId = req.nextUrl.searchParams.get("updateId");

  if (!updateId) {
    return apiError("updateId wajib diisi", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
    });
  }

  const result = await getAdminWorkOrderRouteService().getMaterialDetail({
    workOrderId: ctx.params.id,
    updateId,
    actor: ctx.session!.user,
    permissions: ctx.permissions,
  });

  if (result.success) {
    return apiSuccess(result.data);
  }

  if (result.code === "UNAUTHORIZED") {
    return ApiErrors.unauthorized();
  }

  if (result.code === "FORBIDDEN") {
    return ApiErrors.forbidden(
      "error" in result && result.error ? result.error : "Akses ditolak",
    );
  }

  if (result.code === "INVALID_WORK_ORDER") {
    return apiError(
      "Update tidak ditemukan pada work order ini",
      ErrorCodes.VALIDATION_ERROR,
      { status: 400 },
    );
  }

  return ApiErrors.notFound("Update");
});
