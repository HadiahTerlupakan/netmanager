import {
  apiSuccess,
  ApiErrors,
  createHandler,
  validateRequestBody,
} from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import {
  getApprovalThresholdService,
  updateApprovalThresholdSchema,
  toApprovalThresholdDTO,
  ApprovalThresholdInvalidError,
  ApprovalThresholdNotFoundError,
  type UpdateApprovalThresholdInput,
} from "@/modules/procurement";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/procurement/approval-thresholds/[id]
 */
export const PATCH = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("procurement:update"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk mengubah approval threshold",
    );
  }

  const id = ctx.params?.id;
  if (typeof id !== "string") {
    return ApiErrors.badRequest("ID threshold tidak valid");
  }

  const validation = await validateRequestBody(
    req,
    updateApprovalThresholdSchema,
  );
  if (!validation.success) {
    return ApiErrors.badRequest(
      validation.errors?.map((e) => e.message).join(", ") ??
        "Input tidak valid",
    );
  }

  const data = validation.data as UpdateApprovalThresholdInput;
  try {
    const updated = await getApprovalThresholdService().update(id, {
      minAmount: data.minAmount,
      maxAmount: data.maxAmount,
      description: data.description,
      isActive: data.isActive,
    });
    return apiSuccess(toApprovalThresholdDTO(updated), {
      message: "Approval threshold berhasil diperbarui",
    });
  } catch (error) {
    if (error instanceof ApprovalThresholdNotFoundError) {
      return ApiErrors.notFound(error.message);
    }
    if (error instanceof ApprovalThresholdInvalidError) {
      return ApiErrors.badRequest(error.message);
    }
    throw error;
  }
});

/**
 * DELETE /api/admin/procurement/approval-thresholds/[id]
 */
export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("procurement:delete"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menghapus approval threshold",
    );
  }

  const id = ctx.params?.id;
  if (typeof id !== "string") {
    return ApiErrors.badRequest("ID threshold tidak valid");
  }

  try {
    await getApprovalThresholdService().delete(id);
    return apiSuccess({ id }, { message: "Threshold berhasil dihapus" });
  } catch (error) {
    if (error instanceof ApprovalThresholdNotFoundError) {
      return ApiErrors.notFound(error.message);
    }
    throw error;
  }
});
