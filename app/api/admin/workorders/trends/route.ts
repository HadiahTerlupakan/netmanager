import { adminWorkOrderRouteService } from "@/modules/work-order";
import { hasPermission } from "@/lib/rbac";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";

/** GET /api/admin/workorders/trends */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("work_order_dashboard:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat tren work order",
    );
  }

  const startDateParam = req.nextUrl.searchParams.get("startDate");
  const endDateParam = req.nextUrl.searchParams.get("endDate");

  if (!startDateParam || !endDateParam) {
    return apiError(
      "startDate dan endDate wajib diisi",
      ErrorCodes.VALIDATION_ERROR,
      { status: 400 },
    );
  }

  const startDate = new Date(startDateParam);
  const endDate = new Date(endDateParam);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return apiError("Format tanggal tidak valid", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
    });
  }

  if (startDate > endDate) {
    return apiError(
      "startDate harus sebelum endDate",
      ErrorCodes.VALIDATION_ERROR,
      { status: 400 },
    );
  }

  const result = await adminWorkOrderRouteService.getTrends({
    startDate,
    endDate,
    user: ctx.session!.user,
    permissions: ctx.permissions,
  });

  if (!result.success) {
    return ApiErrors.unauthorized();
  }

  return apiSuccess(result.data);
});
