import {
  getWorkOrderService,
  getAdminWorkOrderRouteService,
} from "@/modules/work-order";
import { hasPermission } from "@/lib/rbac";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";

/** GET /api/admin/workorders/{id} */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("list:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat work order",
    );
  }

  const userContext = await getAdminWorkOrderRouteService().getUserContext(
    ctx.session!.user,
    ctx.permissions,
  );

  if (!userContext) {
    return ApiErrors.unauthorized();
  }

  const result = await getWorkOrderService().getWorkOrderById(
    ctx.params.id,
    userContext,
  );

  if (!result.success) {
    if (result.code === "NOT_FOUND") {
      return ApiErrors.notFound("Work Order");
    }

    if (result.code === "FORBIDDEN") {
      return ApiErrors.forbidden(result.error || "Akses ditolak");
    }

    return apiError(
      result.error || "Gagal mengambil work order",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }

  return apiSuccess(result.data);
});

/** PATCH /api/admin/workorders/{id} */
export const PATCH = createHandler({ auth: true }, async (req, ctx) => {
  const body = await req.json();
  const userContext = await getAdminWorkOrderRouteService().getUserContext(
    ctx.session!.user,
    ctx.permissions,
  );

  if (!userContext) {
    return ApiErrors.unauthorized();
  }

  const requiredPermission =
    body.status === "VERIFIED" || body.rejectionReason
      ? "list:verify"
      : "list:update";

  if (!(await hasPermission(requiredPermission))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki permission untuk tindakan ini",
    );
  }

  const workOrderService = getWorkOrderService();

  if (body.rejectionReason) {
    await workOrderService.addComment(
      ctx.params.id,
      `[REJECTED] ${body.rejectionReason}`,
      userContext,
    );
    delete body.rejectionReason;
  }

  if (body.status) {
    const statusResult = await workOrderService.updateStatus(
      ctx.params.id,
      body.status,
      userContext,
    );

    if (!statusResult.success) {
      if (statusResult.code === "FORBIDDEN") {
        return ApiErrors.forbidden(statusResult.error || "Akses ditolak");
      }

      if (statusResult.code === "NOT_FOUND") {
        return ApiErrors.notFound("Work Order");
      }

      return apiError(
        statusResult.error || "Gagal update status",
        ErrorCodes.INTERNAL_ERROR,
        { status: 500 },
      );
    }

    delete body.status;
  }

  if (Object.keys(body).length > 0) {
    const updateResult = await workOrderService.updateWorkOrder(
      ctx.params.id,
      body,
      userContext,
    );

    if (!updateResult.success) {
      return apiError(
        updateResult.error || "Gagal memperbarui work order",
        ErrorCodes.INTERNAL_ERROR,
        { status: 500 },
      );
    }
  }

  const workOrderResult = await workOrderService.getWorkOrderById(
    ctx.params.id,
    userContext,
  );
  return apiSuccess(workOrderResult.data, {
    message: "Work order berhasil diperbarui",
  });
});

/** DELETE /api/admin/workorders/{id} */
export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
  const reason = req.nextUrl.searchParams.get("reason") || "Cancelled by admin";
  const isPermanent = req.nextUrl.searchParams.get("permanent") === "true";
  const requiredPermission = isPermanent ? "list:delete" : "list:cancel";

  if (!(await hasPermission(requiredPermission))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki permission untuk tindakan ini",
    );
  }

  const result = await getAdminWorkOrderRouteService().deleteWorkOrder({
    workOrderId: ctx.params.id,
    permanent: isPermanent,
    reason,
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
      return ApiErrors.forbidden(result.error || "Akses ditolak");
    }

    return apiError(
      result.error ||
        (isPermanent
          ? "Gagal menghapus work order"
          : "Gagal membatalkan work order"),
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }

  return apiSuccess(null, {
    message: isPermanent
      ? "Work order berhasil dihapus permanen"
      : "Work order berhasil dibatalkan",
  });
});
