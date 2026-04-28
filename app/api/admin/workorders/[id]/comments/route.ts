import { hasPermission } from "@/lib/rbac";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";
import { getAdminWorkOrderRouteService } from "@/modules/work-order";

/** POST /api/admin/workorders/[id]/comments */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const { id } = ctx.params;

  if (!(await hasPermission("list:update"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menambah komentar",
    );
  }

  const body = await req.json();
  const message = body.message;

  if (!message) {
    return apiError("Pesan wajib diisi", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
    });
  }

  const result = await getAdminWorkOrderRouteService().addComment({
    workOrderId: id,
    message,
    actor: user,
    permissions: ctx.permissions,
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

    return apiError(
      result.error || "Gagal menambah komentar",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }

  return apiSuccess(result.data, {
    status: 201,
    message: "Komentar berhasil ditambahkan",
  });
});
