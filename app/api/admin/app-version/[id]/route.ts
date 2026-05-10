import { hasPermission } from "@/lib/rbac";
import {
  getAppVersionService,
  updateAppVersionSchema,
} from "@/modules/app-version";
import {
  apiSuccess,
  ApiErrors,
  createHandler,
  apiError,
  ErrorCodes,
} from "@/lib/api";
import { logActivitySafe } from "@/lib/logger";

// GET /api/admin/app-version/[id] - Get version detail
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("app_version:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat versi aplikasi",
    );
  }

  const { id } = ctx.params;
  const service = await getAppVersionService();
  const version = await service.getVersionById(id);

  if (!version) {
    return ApiErrors.notFound("Versi aplikasi");
  }

  return apiSuccess(version);
});

// PUT /api/admin/app-version/[id] - Update version info
export const PUT = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("app_version:update"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk mengubah versi aplikasi",
    );
  }

  const { id } = ctx.params;
  const body = await req.json();

  // Validate input with Zod
  const parseResult = updateAppVersionSchema.safeParse(body);
  if (!parseResult.success) {
    return apiError("Data input tidak valid", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
      details: { issues: parseResult.error.issues },
    });
  }

  const service = await getAppVersionService();
  const version = await service.updateVersion(id, parseResult.data);

  // System Log
  logActivitySafe({
    action: "UPDATE",
    subject: "AppVersion",
    userId: ctx.session!.user.id,
    details: { id: version.id, version: version.version },
  });

  return apiSuccess(version, { message: "Versi berhasil diperbarui" });
});

// DELETE /api/admin/app-version/[id] - Hard delete version and file
export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("app_version:delete"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menghapus versi aplikasi",
    );
  }

  const { id } = ctx.params;
  const service = await getAppVersionService();
  try {
    await service.deleteVersion(id);
  } catch (error) {
    if (error instanceof Error && error.message === "Versi tidak ditemukan") {
      return ApiErrors.notFound("Versi aplikasi");
    }

    throw error;
  }

  // System Log
  logActivitySafe({
    action: "DELETE",
    subject: "AppVersion",
    userId: ctx.session!.user.id,
    details: { id },
  });

  return apiSuccess(null, {
    message: "Versi dan file berhasil dihapus permanen",
  });
});
