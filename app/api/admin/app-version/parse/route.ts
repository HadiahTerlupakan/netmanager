import { hasPermission } from "@/lib/rbac";
import {
  apiSuccess,
  ApiErrors,
  apiError,
  ErrorCodes,
  createHandler,
} from "@/lib/api";
import {
  AppVersionValidationError,
  getAppVersionService,
} from "@/modules/app-version";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export const POST = createHandler({ auth: true }, async (req, _ctx) => {
  if (!(await hasPermission("app_version:create"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk upload versi aplikasi",
    );
  }

  const body = await req.json().catch((): unknown => null);
  const uploadedKey =
    body && typeof body === "object" && "uploadedKey" in body
      ? (body as { uploadedKey?: unknown }).uploadedKey
      : undefined;

  if (typeof uploadedKey !== "string" || !uploadedKey) {
    return apiError("uploadedKey wajib diisi", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
    });
  }

  try {
    const service = await getAppVersionService();
    const apkInfo = await service.parseUploadedApk(uploadedKey);
    if (!apkInfo) {
      return apiError(
        "Gagal membaca metadata APK",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    return apiSuccess({
      version: apkInfo.versionName,
      buildNumber: apkInfo.buildNumber,
      versionCode: apkInfo.versionCode,
      packageName: apkInfo.packageName,
    });
  } catch (error) {
    if (error instanceof AppVersionValidationError) {
      return apiError(error.message, ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }
    throw error;
  }
});
