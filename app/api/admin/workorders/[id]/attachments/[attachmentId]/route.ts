import { hasPermission } from "@/lib/rbac";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";
import {
  getWorkOrderService,
  getAdminWorkOrderRouteService,
} from "@/modules/work-order";

/** DELETE /api/admin/workorders/[id]/attachments/[attachmentId] */
export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("workorders:update"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menghapus attachment",
    );
  }

  const { id, attachmentId } = ctx.params;

  if (!id || !attachmentId) {
    return apiError(
      "ID Work Order dan Attachment ID wajib diisi",
      ErrorCodes.VALIDATION_ERROR,
      { status: 400 },
    );
  }

  const userContext = await getAdminWorkOrderRouteService().getUserContext(
    ctx.session!.user,
    ctx.permissions,
  );

  if (!userContext) {
    return ApiErrors.unauthorized();
  }

  const result = await getWorkOrderService().deleteAttachment(
    id,
    attachmentId,
    userContext,
  );

  if (!result.success) {
    if (result.code === "NOT_FOUND") {
      return ApiErrors.notFound(result.error || "Attachment tidak ditemukan");
    }

    return apiError(
      result.error || "Gagal menghapus attachment",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }

  return apiSuccess(null, { message: "Attachment berhasil dihapus" });
});
