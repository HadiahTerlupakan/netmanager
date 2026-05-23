import { NextRequest } from "next/server";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth";
import { convertAndSaveImage } from "@/lib/utils/image-upload";
import { validateUploadFile } from "@/lib/upload/upload-policy";
import { logger } from "@/lib/logger";

const UPLOAD_FOLDER = "landing-logo";

/**
 * POST /api/admin/website/upload-logo - Upload landing page logo (super admin only).
 * Returns the public URL of the uploaded logo to be saved in hero.logoUrl or footer.logoUrl.
 */
export const POST = createHandler(
  { auth: true },
  async (request: NextRequest, ctx) => {
    if (!isSuperAdmin(ctx.session?.user)) {
      return ApiErrors.forbidden();
    }

    try {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return ApiErrors.badRequest("Tidak ada file yang diunggah");
      }

      const validation = validateUploadFile({
        folder: UPLOAD_FOLDER,
        mimeType: file.type,
        size: file.size,
        fileName: file.name,
      });

      if (!validation.ok || !validation.safeBaseName || !validation.extension) {
        return ApiErrors.badRequest(validation.error ?? "File tidak valid");
      }

      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(7);
      const fileName = `${validation.safeBaseName}_${timestamp}_${randomStr}`;
      const uploadDir = `public/uploads/${UPLOAD_FOLDER}`;

      const url = await convertAndSaveImage(file, uploadDir, fileName, "logos");
      const publicUrl = url.replace(/^public\//, "/").replace(/^\/?/, "/");

      return apiSuccess({ url: publicUrl });
    } catch (error) {
      logger.error("[Upload Landing Logo]", error);
      return ApiErrors.internalError("Gagal mengunggah logo");
    }
  },
);
