import { hasPermission } from "@/lib/rbac";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  apiPaginated,
  createHandler,
} from "@/lib/api";
import { logActivitySafe } from "@/lib/logger";
import {
  AppVersionConflictError,
  AppVersionValidationError,
  getAppVersionService,
  parseAppVersionUploadForm,
} from "@/modules/app-version";
import type { UploadVersionInput } from "@/modules/app-version";

// Route segment config for large file uploads (APK)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes for large APK uploads

// GET /api/admin/app-version - List all app versions
export const GET = createHandler({ auth: true }, async (req, _ctx) => {
  if (!(await hasPermission("app_version:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat versi aplikasi",
    );
  }

  const { searchParams } = req.nextUrl;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  const platform = searchParams.get("platform") || undefined;
  const isActive =
    searchParams.get("isActive") === "true"
      ? true
      : searchParams.get("isActive") === "false"
        ? false
        : undefined;

  const service = await getAppVersionService();
  const result = await service.getAllVersions({
    page,
    limit,
    ...(platform ? { platform } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
  });

  return apiPaginated(result.data, {
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
});

// POST /api/admin/app-version - Upload new app version
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("app_version:create"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk upload versi aplikasi",
    );
  }

  const formData = await req.formData();
  let uploadInput: UploadVersionInput;

  try {
    uploadInput = parseAppVersionUploadForm(formData);
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Input metadata tidak valid",
      ErrorCodes.VALIDATION_ERROR,
      { status: 400 },
    );
  }

  const service = await getAppVersionService();
  try {
    const appVersion = await service.uploadVersion({
      ...uploadInput,
      createdBy: ctx.session!.user.id,
    });

    logActivitySafe({
      action: "CREATE",
      subject: "AppVersion",
      userId: ctx.session!.user.id,
      details: { id: appVersion.id, version: appVersion.version },
    });

    return apiSuccess(appVersion, {
      status: 201,
      message: "Versi aplikasi berhasil diupload",
    });
  } catch (error) {
    if (error instanceof AppVersionValidationError) {
      return apiError(error.message, ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }
    if (error instanceof AppVersionConflictError) {
      return apiError(error.message, ErrorCodes.CONFLICT, { status: 409 });
    }
    throw error;
  }
});
