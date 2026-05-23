import { logger } from "@/lib/logger";
import { convertAndSaveImage } from "@/lib/utils/image-upload";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";
import { buildTenantUploadDir } from "@/lib/upload/upload-policy";
import {
  AdminProfileRouteError,
  AdminProfileRouteService,
} from "@/modules/users";

const MAX_PROFILE_PHOTO_SIZE = 5 * 1024 * 1024;
const PROFILE_UPLOAD_DIR = "public/uploads/profiles";
const adminProfileRouteService = new AdminProfileRouteService();

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const formData = await req.formData();
  const photo = formData.get("photo") as File;

  if (!photo) {
    return apiError("Foto wajib diupload", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
    });
  }

  if (!photo.type.startsWith("image/")) {
    return apiError("File harus berupa gambar", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
    });
  }

  if (photo.size > MAX_PROFILE_PHOTO_SIZE) {
    return apiError("Ukuran foto maksimal 5MB", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
    });
  }

  const tenantId = ctx.session!.user.tenantId;
  if (!tenantId) {
    return ApiErrors.badRequest("Tenant ID tidak ditemukan");
  }

  const fileName = `${ctx.session!.user.id}_${Date.now()}`;
  const uploadDir = buildTenantUploadDir(PROFILE_UPLOAD_DIR, tenantId);

  try {
    const imageUrl = await convertAndSaveImage(
      photo,
      uploadDir,
      fileName,
      "user-profile",
      ctx.session!.user.id,
    );
    const updated = await adminProfileRouteService.updatePhoto(
      ctx.session!.user.id,
      imageUrl,
    );
    return apiSuccess(updated, { message: "Foto profil berhasil diperbarui" });
  } catch (error) {
    if (error instanceof AdminProfileRouteError && error.status === 404) {
      return ApiErrors.notFound("User");
    }

    logger.error(
      "Profile photo upload error:",
      error instanceof Error ? error.message : error,
    );
    return ApiErrors.internalError("Gagal upload foto profil");
  }
});
