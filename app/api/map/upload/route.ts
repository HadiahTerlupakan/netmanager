import { logger } from "@/lib/logger";
import { createHandler, apiSuccess, apiError } from "@/lib/api";
import { buildTenantUploadDir } from "@/lib/upload/upload-policy";
import { convertAndSaveImage } from "@/lib/utils/image-upload";
import { randomUUID } from "crypto";

/**
 * @swagger
 * /api/map/upload:
 *   post:
 *     summary: Upload photo for map node
 *     tags: [Map]
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["map:create", "map:update"],
  },
  async (req, ctx) => {
    const formData = await req.formData();
    const file = formData.get("photo") as File;

    if (!file) {
      return apiError("Photo is required", "VALIDATION_ERROR", { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return apiError("File must be an image", "VALIDATION_ERROR", {
        status: 400,
      });
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      return apiError("Photo size max 5MB", "VALIDATION_ERROR", {
        status: 400,
      });
    }

    const tenantId = ctx.session?.user?.tenantId;
    if (!tenantId) {
      return apiError("Tenant tidak ditemukan", "VALIDATION_ERROR", {
        status: 400,
      });
    }

    const uploadDir = buildTenantUploadDir(
      "public/uploads/map/nodes",
      tenantId,
    );
    const fileName = `node_${Date.now()}_${randomUUID().split("-")[0]}`;

    try {
      const imageUrl = await convertAndSaveImage(
        file,
        uploadDir,
        fileName,
        "map-nodes",
      );

      return apiSuccess({ url: imageUrl });
    } catch (error) {
      logger.error("Map node photo upload error:", error);
      return apiError("Failed to upload photo", "INTERNAL_ERROR", {
        status: 500,
      });
    }
  },
);
