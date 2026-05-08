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

/** GET /api/admin/workorders/[id]/tasks */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const userContext = await getAdminWorkOrderRouteService().getUserContext(
    ctx.session!.user,
    ctx.permissions,
  );

  if (!(await hasPermission("workorders:read"))) {
    return ApiErrors.forbidden("Anda tidak memiliki akses untuk melihat tasks");
  }

  if (!userContext) {
    return ApiErrors.unauthorized();
  }

  const result = await getWorkOrderService().getWorkOrderById(
    ctx.params.id,
    userContext,
  );

  if (!result.success) {
    if (result.code === "FORBIDDEN") {
      return ApiErrors.forbidden(result.error || "Akses ditolak");
    }

    if (result.code === "NOT_FOUND") {
      return ApiErrors.notFound("Work Order");
    }

    return apiError(
      result.error || "Gagal mengambil tasks",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }

  return apiSuccess(result.data?.tasks || []);
});

/** POST /api/admin/workorders/[id]/tasks */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const body = await req.json();

  if (!(await hasPermission("workorders:update"))) {
    return ApiErrors.forbidden("Anda tidak memiliki akses untuk menambah task");
  }

  if (!body.title) {
    return apiError("Judul task wajib diisi", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
    });
  }

  const result = await getAdminWorkOrderRouteService().addTask({
    workOrderId: ctx.params.id,
    title: body.title,
    description: body.description,
    order: body.order,
    actor: ctx.session!.user,
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
      result.error || "Gagal menambah task",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }

  return apiSuccess(result.data, {
    status: 201,
    message: "Task berhasil ditambahkan",
  });
});
