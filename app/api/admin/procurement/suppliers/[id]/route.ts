import {
  apiSuccess,
  ApiErrors,
  createHandler,
  validateRequestBody,
} from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import {
  getSupplierService,
  updateSupplierSchema,
  toSupplierDTO,
  SupplierNotFoundError,
} from "@/modules/procurement";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/procurement/suppliers/[id]
 */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("supplier:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat data supplier",
    );
  }

  const id = ctx.params?.id;
  if (typeof id !== "string") {
    return ApiErrors.badRequest("ID supplier tidak valid");
  }

  try {
    const supplier = await getSupplierService().getById(id);
    return apiSuccess(toSupplierDTO(supplier));
  } catch (error) {
    if (error instanceof SupplierNotFoundError) {
      return ApiErrors.notFound(error.message);
    }
    throw error;
  }
});

/**
 * PATCH /api/admin/procurement/suppliers/[id]
 */
export const PATCH = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("supplier:update"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk mengubah data supplier",
    );
  }

  const id = ctx.params?.id;
  if (typeof id !== "string") {
    return ApiErrors.badRequest("ID supplier tidak valid");
  }

  const validation = await validateRequestBody(req, updateSupplierSchema);
  if (!validation.success) {
    return ApiErrors.badRequest(
      validation.errors?.map((e) => e.message).join(", ") ??
        "Input tidak valid",
    );
  }

  try {
    const supplier = await getSupplierService().update(id, validation.data);
    return apiSuccess(toSupplierDTO(supplier), {
      message: "Supplier berhasil diperbarui",
    });
  } catch (error) {
    if (error instanceof SupplierNotFoundError) {
      return ApiErrors.notFound(error.message);
    }
    throw error;
  }
});

/**
 * DELETE /api/admin/procurement/suppliers/[id]
 */
export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("supplier:delete"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menghapus supplier",
    );
  }

  const id = ctx.params?.id;
  if (typeof id !== "string") {
    return ApiErrors.badRequest("ID supplier tidak valid");
  }

  try {
    await getSupplierService().delete(id);
    return apiSuccess({ id }, { message: "Supplier berhasil dihapus" });
  } catch (error) {
    if (error instanceof SupplierNotFoundError) {
      return ApiErrors.notFound(error.message);
    }
    throw error;
  }
});
