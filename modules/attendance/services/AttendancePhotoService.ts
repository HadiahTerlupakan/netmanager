/**
 * Attendance Photo Service
 * Centralized photo processing for check-in and check-out
 * Reduces code duplication across API routes
 */

import { convertAndSaveImage } from "@/lib/utils/image-upload";
import { ATTENDANCE_CONSTANTS } from "../utils/constants";
import { AttendancePhotoValidationService } from "./AttendancePhotoValidationService";
import { logger } from "@/lib/logger";

const BYTES_PER_MEGABYTE = 1024 * 1024;

export class AttendancePhotoService {
  private validationService = new AttendancePhotoValidationService();

  /**
   * Process and upload attendance photo
   * Handles both File objects and base64 strings
   *
   * @param photo - Photo as File or base64 string
   * @param userId - User ID for file naming
   * @param type - 'checkin' or 'checkout'
   * @returns URL of uploaded photo or null if no photo provided
   * @throws Error if validation fails
   */
  async processPhoto(
    photo: File | string | null,
    userId: string,
    type: "checkin" | "checkout",
  ): Promise<string | null> {
    if (!photo) return null;
    if (photo instanceof File) return this.uploadPhotoFile(photo, userId, type);
    if (typeof photo === "string")
      return this.processBase64Photo(photo, userId, type);
    throw new Error("Format foto tidak valid");
  }

  /** Validate dan upload file foto absensi. */
  private async uploadPhotoFile(
    photoFile: File,
    userId: string,
    type: "checkin" | "checkout",
  ): Promise<string> {
    // Enhanced validation
    const validationResult =
      await this.validationService.validatePhoto(photoFile);

    if (!validationResult.isValid) {
      logger.warn("Photo validation failed", {
        userId,
        type,
        error: validationResult.error,
        fileName: photoFile.name,
        fileSize: photoFile.size,
      });
      throw new Error(validationResult.error || "Validasi foto gagal");
    }

    logger.info("Photo validated successfully", {
      userId,
      type,
      metadata: validationResult.metadata,
    });

    // Legacy validation (kept for backward compatibility)
    this.validatePhotoFile(photoFile);

    const uploadDir = this.buildUploadDirectory();
    const fileName = `${userId}_${type}_${Date.now()}`;

    return convertAndSaveImage(
      photoFile,
      uploadDir,
      fileName,
      "employee-attendance",
      userId,
    );
  }

  /** Convert foto string menjadi file lalu proses seperti upload biasa. */
  private async processBase64Photo(
    photoUrl: string,
    userId: string,
    type: "checkin" | "checkout",
  ): Promise<string | null> {
    const response = await fetch(photoUrl);
    const blob = await response.blob();
    const photoFile = new File([blob], `${type}.jpg`, { type: "image/jpeg" });
    return this.processPhoto(photoFile, userId, type);
  }

  /** Validasi tipe dan ukuran file foto absensi. */
  private validatePhotoFile(photoFile: File): void {
    if (!photoFile.type.startsWith("image/")) {
      throw new Error("File harus berupa gambar");
    }

    if (photoFile.size <= ATTENDANCE_CONSTANTS.MAX_PHOTO_SIZE) return;
    const maxSizeMB = ATTENDANCE_CONSTANTS.MAX_PHOTO_SIZE / BYTES_PER_MEGABYTE;
    throw new Error(`Ukuran foto maksimal ${maxSizeMB}MB`);
  }

  /** Bangun direktori upload harian untuk foto absensi. */
  private buildUploadDirectory(): string {
    const dateString = new Date().toISOString().split("T")[0];
    return `${ATTENDANCE_CONSTANTS.PHOTO_UPLOAD_DIR}/${dateString}`;
  }
}
