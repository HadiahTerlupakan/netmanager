import { hasPermission } from "@/lib/rbac";
import {
  apiSuccess,
  ApiErrors,
  apiError,
  ErrorCodes,
  createHandler,
} from "@/lib/api";
import { logActivitySafe } from "@/lib/logger";
import {
  AppUpdateNotFoundError,
  getAppUpdateService,
} from "@/modules/app-update";

export const dynamic = "force-dynamic";

// GET /api/admin/app-update/[id]
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("app_version:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat Expo updates",
    );
  }

  const { id } = ctx.params;
  const service = await getAppUpdateService();
  const update = await service.getById(id);
  if (!update) return ApiErrors.notFound("Expo update");
  return apiSuccess({ ...update, bundleSize: Number(update.bundleSize) });
});

// PATCH /api/admin/app-update/[id] — toggle isActive
export const PATCH = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("app_version:update"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk mengubah Expo updates",
    );
  }

  const { id } = ctx.params;
  const body = (await req.json().catch((): unknown => null)) as {
    isActive?: boolean;
  } | null;
  if (!body || typeof body.isActive !== "boolean") {
    return apiError("isActive boolean wajib", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
    });
  }

  const service = await getAppUpdateService();
  try {
    const updated = await service.setActive(id, body.isActive);
    logActivitySafe({
      action: "UPDATE",
      subject: "AppUpdate",
      userId: ctx.session!.user.id,
      details: { id: updated.id, isActive: updated.isActive },
    });
    return apiSuccess(
      { ...updated, bundleSize: Number(updated.bundleSize) },
      { message: body.isActive ? "Update diaktifkan" : "Update dinonaktifkan" },
    );
  } catch (error) {
    if (error instanceof AppUpdateNotFoundError) {
      return ApiErrors.notFound("Expo update");
    }
    throw error;
  }
});

// DELETE /api/admin/app-update/[id]
export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("app_version:delete"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menghapus Expo updates",
    );
  }

  const { id } = ctx.params;
  const service = await getAppUpdateService();
  try {
    await service.deleteUpdate(id);
    logActivitySafe({
      action: "DELETE",
      subject: "AppUpdate",
      userId: ctx.session!.user.id,
      details: { id },
    });
    return apiSuccess(null, { message: "Expo update berhasil dihapus" });
  } catch (error) {
    if (error instanceof AppUpdateNotFoundError) {
      return ApiErrors.notFound("Expo update");
    }
    throw error;
  }
});
