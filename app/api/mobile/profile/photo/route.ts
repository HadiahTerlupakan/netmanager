import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

import { apiError, apiSuccess, ErrorCodes } from "@/lib/api-response";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { buildTenantUploadDir } from "@/lib/upload/upload-policy";
import { convertAndSaveImage } from "@/lib/utils/image-upload";
import { saveMobileProfilePhoto } from "@/modules/users";

const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
const PROFILE_UPLOAD_DIR = "public/uploads/profiles";

/** Mengunggah foto profil mobile lalu menyimpan URL-nya ke user. */
export async function POST(request: Request) {
  try {
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const formData = await request.formData();
    const photo = formData.get("photo") as File | null;
    if (!photo) {
      return apiError("Foto wajib diisi", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

    if (!photo.type.startsWith("image/")) {
      return apiError("File harus berupa gambar", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

    if (photo.size > MAX_PHOTO_SIZE) {
      return apiError("Ukuran foto maksimal 5MB", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

    const userId = authResult.id as string;
    const tenantId = authResult.tenantId as string;
    if (!tenantId) {
      return apiError("Tenant tidak ditemukan", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

    const uploadDir = buildTenantUploadDir(PROFILE_UPLOAD_DIR, tenantId);
    const imageUrl = await convertAndSaveImage(
      photo,
      uploadDir,
      `${userId}_${Date.now()}`,
      "user-profile",
      userId,
    );

    return apiSuccess(
      await saveMobileProfilePhoto({
        userId,
        tenantId,
        imageUrl,
      }),
    );
  } catch (error: unknown) {
    logger.error("Profile photo upload error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    return apiError(errorMessage, ErrorCodes.INTERNAL_ERROR, { status: 500 });
  }
}
