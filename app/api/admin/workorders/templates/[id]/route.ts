import { adminWorkOrderConfigService } from "@/modules/work-order";
import { workOrderTemplateUpdateSchema } from "@/lib/validations/workorder-template";
import { hasPermission } from "@/lib/rbac";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";

/** GET /api/admin/workorders/templates/{id} */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("wo_template:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat template work order",
    );
  }

  const result = await adminWorkOrderConfigService.getTemplateById(
    ctx.params.id,
  );

  if (!result.success) {
    if (result.code === ErrorCodes.NOT_FOUND) {
      return ApiErrors.notFound("Template Work Order");
    }

    return apiError(
      result.error || "Gagal mengambil template work order",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }

  return apiSuccess(result.data);
});

/** PUT /api/admin/workorders/templates/{id} */
export const PUT = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("wo_template:update"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk mengupdate template work order",
    );
  }

  const body = await req.json();
  const validatedData = workOrderTemplateUpdateSchema.parse(body);
  const result = await adminWorkOrderConfigService.updateTemplate(
    ctx.params.id,
    validatedData,
  );

  if (!result.success) {
    if (result.code === ErrorCodes.NOT_FOUND) {
      return ApiErrors.notFound("Template Work Order");
    }

    return apiError(
      result.error || "Gagal memperbarui template work order",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }

  return apiSuccess(result.data, {
    message: "Template work order berhasil diperbarui",
  });
});

/** DELETE /api/admin/workorders/templates/{id} */
export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("wo_template:delete"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menghapus template work order",
    );
  }

  const result = await adminWorkOrderConfigService.deleteTemplate(
    ctx.params.id,
  );

  if (!result.success) {
    if (result.code === ErrorCodes.NOT_FOUND) {
      return ApiErrors.notFound("Template Work Order");
    }

    if (result.code === ErrorCodes.VALIDATION_ERROR) {
      return apiError(
        result.error || "Validasi gagal",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    return apiError(
      result.error || "Gagal menghapus template work order",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }

  return apiSuccess(null, { message: "Template work order berhasil dihapus" });
});
