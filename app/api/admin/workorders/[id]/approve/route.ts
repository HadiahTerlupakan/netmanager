import { getAdminWorkOrderRouteService } from "@/modules/work-order";
import { hasPermission } from "@/lib/rbac";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";

/** POST /api/admin/workorders/[id]/approve */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const { id } = ctx.params;
  const hasApprovePermission =
    (await hasPermission("workorders:approve_request")) ||
    (await hasPermission("workorders:requests:approve"));

  if (!hasApprovePermission) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk approve/reject work order",
    );
  }

  const body = await req.json();

  if (!body.action || !["APPROVE", "REJECT"].includes(body.action)) {
    return apiError(
      "Action harus APPROVE atau REJECT",
      ErrorCodes.VALIDATION_ERROR,
      { status: 400 },
    );
  }

  if (body.action === "REJECT" && !body.reason) {
    return apiError(
      "Alasan wajib diisi saat menolak",
      ErrorCodes.VALIDATION_ERROR,
      { status: 400 },
    );
  }

  const result = await getAdminWorkOrderRouteService().processRequestApproval({
    workOrderId: id,
    action: body.action,
    actor: user,
    permissions: ctx.permissions,
    reason: body.reason,
  });

  if (!result.success) {
    if (result.code === "UNAUTHORIZED") {
      return ApiErrors.unauthorized();
    }

    if (result.code === "FORBIDDEN") {
      return ApiErrors.forbidden(result.error || "Akses ditolak");
    }

    if (result.code === "NOT_FOUND") {
      return ApiErrors.notFound("Work Order");
    }

    const statusCode = result.code === "INVALID_STATUS" ? 400 : 500;
    return apiError(
      result.error || "Gagal memproses request",
      ErrorCodes.INTERNAL_ERROR,
      { status: statusCode },
    );
  }

  return apiSuccess(result.data, {
    message:
      body.action === "APPROVE"
        ? "Work order request berhasil disetujui"
        : "Work order request ditolak",
  });
});
