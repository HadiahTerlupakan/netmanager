import { adminWorkOrderConfigService } from "@/modules/work-order";
import { slaUpdateSchema } from "@/lib/validations/sla";
import { hasPermission } from "@/lib/rbac";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";

/** GET /api/admin/workorders/slas/{id} */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("wo_sla:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat aturan SLA",
    );
  }

  const result = await adminWorkOrderConfigService.getSlaById(ctx.params.id);

  if (!result.success) {
    if (result.code === ErrorCodes.NOT_FOUND) {
      return ApiErrors.notFound("Aturan SLA");
    }

    return apiError(
      result.error || "Gagal mengambil aturan SLA",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }

  return apiSuccess(result.data);
});

/** PUT /api/admin/workorders/slas/{id} */
export const PUT = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("wo_sla:update"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk mengupdate aturan SLA",
    );
  }

  const body = await req.json();
  const validatedData = slaUpdateSchema.parse(body);
  const result = await adminWorkOrderConfigService.updateSla(
    ctx.params.id,
    validatedData,
  );

  if (!result.success) {
    if (result.code === ErrorCodes.NOT_FOUND) {
      return ApiErrors.notFound("Aturan SLA");
    }

    return apiError(
      result.error || "Gagal memperbarui aturan SLA",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }

  return apiSuccess(result.data, { message: "Aturan SLA berhasil diperbarui" });
});

/** DELETE /api/admin/workorders/slas/{id} */
export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("wo_sla:delete"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menghapus aturan SLA",
    );
  }

  const result = await adminWorkOrderConfigService.deleteSla(ctx.params.id);

  if (!result.success) {
    if (result.code === ErrorCodes.NOT_FOUND) {
      return ApiErrors.notFound("Aturan SLA");
    }

    if (result.code === ErrorCodes.VALIDATION_ERROR) {
      return apiError(
        result.error || "Validasi gagal",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    return apiError(
      result.error || "Gagal menghapus aturan SLA",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }

  return apiSuccess(null, { message: "Aturan SLA berhasil dihapus" });
});
