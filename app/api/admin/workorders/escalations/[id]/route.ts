import { getAdminWorkOrderConfigService } from "@/modules/work-order";
import { workOrderEscalationUpdateSchema } from "@/lib/validations/workorder-escalation";
import { hasPermission } from "@/lib/rbac";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";

/** GET /api/admin/workorders/escalations/{id} */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("wo_escalation:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat aturan eskalasi",
    );
  }

  const result = await getAdminWorkOrderConfigService().getEscalationById(
    ctx.params.id,
  );

  if (!result.success) {
    if (result.code === ErrorCodes.NOT_FOUND) {
      return ApiErrors.notFound("Aturan Eskalasi");
    }

    return apiError(
      result.error || "Gagal mengambil aturan eskalasi",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }

  return apiSuccess(result.data);
});

/** PUT /api/admin/workorders/escalations/{id} */
export const PUT = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("wo_escalation:update"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk mengupdate aturan eskalasi",
    );
  }

  const body = await req.json();
  const validatedData = workOrderEscalationUpdateSchema.parse(body);
  const result = await getAdminWorkOrderConfigService().updateEscalation(
    ctx.params.id,
    validatedData,
  );

  if (!result.success) {
    if (result.code === ErrorCodes.NOT_FOUND) {
      return ApiErrors.notFound("Aturan Eskalasi");
    }

    return apiError(
      result.error || "Gagal memperbarui aturan eskalasi",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }

  return apiSuccess(result.data, {
    message: "Aturan eskalasi berhasil diperbarui",
  });
});

/** DELETE /api/admin/workorders/escalations/{id} */
export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("wo_escalation:delete"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menghapus aturan eskalasi",
    );
  }

  const result = await getAdminWorkOrderConfigService().deleteEscalation(
    ctx.params.id,
  );

  if (!result.success) {
    if (result.code === ErrorCodes.NOT_FOUND) {
      return ApiErrors.notFound("Aturan Eskalasi");
    }

    return apiError(
      result.error || "Gagal menghapus aturan eskalasi",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }

  return apiSuccess(null, { message: "Aturan eskalasi berhasil dihapus" });
});
