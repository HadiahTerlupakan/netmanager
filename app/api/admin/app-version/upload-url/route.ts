import { hasPermission } from "@/lib/rbac";
import {
  APP_VERSION_MAX_APK_BYTES,
  getAppVersionService,
} from "@/modules/app-version";
import {
  apiSuccess,
  ApiErrors,
  apiError,
  ErrorCodes,
  createHandler,
} from "@/lib/api";

const ALLOWED_CONTENT_TYPES = new Set([
  "application/vnd.android.package-archive",
  "application/octet-stream",
]);

export const POST = createHandler({ auth: true }, async (req, _ctx) => {
  if (!(await hasPermission("app_version:create"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk upload versi aplikasi",
    );
  }

  const body = await req.json();
  const { filename, contentType, size } = body ?? {};

  if (!filename || !contentType) {
    return apiError(
      "Filename dan content type harus diisi",
      ErrorCodes.VALIDATION_ERROR,
      { status: 400 },
    );
  }

  if (
    typeof filename !== "string" ||
    !filename.toLowerCase().endsWith(".apk")
  ) {
    return apiError(
      "File yang diupload harus berformat APK",
      ErrorCodes.VALIDATION_ERROR,
      { status: 400 },
    );
  }

  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return apiError(
      "Content type file APK tidak valid",
      ErrorCodes.VALIDATION_ERROR,
      { status: 400 },
    );
  }

  if (typeof size === "number" && size > APP_VERSION_MAX_APK_BYTES) {
    const maxMb = Math.round(APP_VERSION_MAX_APK_BYTES / (1024 * 1024));
    return apiError(
      `Ukuran APK maksimal ${maxMb}MB`,
      ErrorCodes.VALIDATION_ERROR,
      { status: 400 },
    );
  }

  const service = await getAppVersionService();
  const { uploadUrl, publicUrl, key } = await service.createDirectUploadUrl({
    filename,
    contentType,
  });

  return apiSuccess({ uploadUrl, publicUrl, key, filename });
});
