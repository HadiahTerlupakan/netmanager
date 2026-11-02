import { hasPermission } from "@/lib/rbac";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";
import { getAdminWorkOrderRouteService } from "@/modules/work-order";

/** POST /api/admin/workorders/[id]/reminder */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("workorders:reminder"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk mengirim reminder",
    );
  }

  let customMessage: string | undefined;
  let targetDepartmentId: string | undefined;

  try {
    const body = await req.json();
    customMessage = body.message;
    targetDepartmentId = body.departmentId;
  } catch {
    customMessage = undefined;
  }

  const result = await getAdminWorkOrderRouteService().sendReminder({
    workOrderId: ctx.params.id,
    customMessage,
    targetDepartmentId,
    actor: ctx.session!.user,
    permissions: ctx.permissions,
  });

  if (!result.success) {
    if (result.code === "UNAUTHORIZED") {
      return ApiErrors.unauthorized();
    }

    if (result.code === "NOT_FOUND") {
      return ApiErrors.notFound("Work Order");
    }

    if (result.code === "FORBIDDEN") {
      return ApiErrors.forbidden(
        ("error" in result && result.error) || "Akses ditolak",
      );
    }

    return apiError(
      "Reminder hanya bisa dikirim untuk WO dengan status Pending, Assigned, atau In Progress",
      ErrorCodes.VALIDATION_ERROR,
      { status: 400 },
    );
  }

  return apiSuccess(result.data, {
    message: `Reminder terkirim ke ${result.data.sentCount} teknisi`,
  });
});
