import path from "path";
import {
  convertAndSaveImage,
  saveFile,
  isImageFile,
} from "@/lib/utils/image-upload";
import { validateFileSignature } from "@/lib/utils/file-validation";

const ALLOWED_UPLOAD_TYPES: ("jpg" | "png" | "pdf")[] = ["jpg", "png", "pdf"];

/**
 * Service untuk menangani upload file pelanggan.
 */
export class PelangganUploadService {
  /**
   * Menyimpan file opsional pelanggan setelah validasi signature.
   */
  async saveOptionalFile(
    file: File | null,
    uploadDir: string,
    baseName: string,
    invalidMessage: string,
  ): Promise<string | null> {
    if (!file || file.size === 0) {
      return null;
    }

    const isValidSignature = await validateFileSignature(
      file,
      ALLOWED_UPLOAD_TYPES,
    );

    if (!isValidSignature) {
      throw new Error(invalidMessage);
    }

    if (isImageFile(file)) {
      return convertAndSaveImage(file, uploadDir, baseName);
    }

    return saveFile(
      file,
      uploadDir,
      `${baseName}${path.extname(file.name) || ".pdf"}`,
    );
  }
}

export const pelangganUploadService = new PelangganUploadService();
