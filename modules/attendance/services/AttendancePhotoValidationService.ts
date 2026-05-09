/**
 * Attendance Photo Validation Service
 * Enhanced security and validation for photo uploads
 */

import sharp from "sharp";
import { ATTENDANCE_CONSTANTS } from "../utils/constants";

const BYTES_PER_MEGABYTE = 1024 * 1024;

export interface PhotoValidationResult {
  isValid: boolean;
  error?: string;
  metadata?: {
    width: number;
    height: number;
    format: string;
    size: number;
  };
}

export interface PhotoCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export class AttendancePhotoValidationService {
  /**
   * Validate photo file comprehensively
   * Checks: file type, size, dimensions, and image integrity
   */
  async validatePhoto(photo: File): Promise<PhotoValidationResult> {
    // 1. Validate file type
    const typeValidation = this.validateFileType(photo);
    if (!typeValidation.isValid) {
      return typeValidation;
    }

    // 2. Validate file size
    const sizeValidation = this.validateFileSize(photo);
    if (!sizeValidation.isValid) {
      return sizeValidation;
    }

    // 3. Validate image integrity and dimensions
    try {
      const buffer = await photo.arrayBuffer();
      const metadata = await sharp(Buffer.from(buffer)).metadata();

      if (!metadata.width || !metadata.height) {
        return {
          isValid: false,
          error: "Tidak dapat membaca dimensi gambar",
        };
      }

      // Check dimensions
      const dimensionValidation = this.validateDimensions(
        metadata.width,
        metadata.height,
      );
      if (!dimensionValidation.isValid) {
        return dimensionValidation;
      }

      // Check if image is corrupted
      if (metadata.width < 1 || metadata.height < 1) {
        return {
          isValid: false,
          error: "File gambar rusak atau tidak valid",
        };
      }

      return {
        isValid: true,
        metadata: {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format || "unknown",
          size: photo.size,
        },
      };
    } catch (_error) {
      return {
        isValid: false,
        error: "File gambar rusak atau format tidak didukung",
      };
    }
  }

  /**
   * Compress and optimize photo
   * Reduces file size while maintaining quality
   */
  async compressPhoto(
    photo: File,
    options?: PhotoCompressionOptions,
  ): Promise<Buffer> {
    const maxWidth = options?.maxWidth || ATTENDANCE_CONSTANTS.PHOTO_MAX_WIDTH;
    const maxHeight =
      options?.maxHeight || ATTENDANCE_CONSTANTS.PHOTO_MAX_HEIGHT;
    const quality =
      options?.quality || ATTENDANCE_CONSTANTS.PHOTO_COMPRESSION_QUALITY;

    const buffer = await photo.arrayBuffer();
    const image = sharp(Buffer.from(buffer));
    const metadata = await image.metadata();

    // Calculate resize dimensions while maintaining aspect ratio
    let resizeWidth = metadata.width;
    let resizeHeight = metadata.height;

    if (resizeWidth && resizeHeight) {
      if (resizeWidth > maxWidth || resizeHeight > maxHeight) {
        const widthRatio = maxWidth / resizeWidth;
        const heightRatio = maxHeight / resizeHeight;
        const ratio = Math.min(widthRatio, heightRatio);

        resizeWidth = Math.round(resizeWidth * ratio);
        resizeHeight = Math.round(resizeHeight * ratio);
      }
    }

    // Compress and convert to WebP for optimal size
    return image
      .resize(resizeWidth, resizeHeight, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality })
      .toBuffer();
  }

  /**
   * Validate file type against allowed types
   */
  private validateFileType(photo: File): PhotoValidationResult {
    const allowedTypes = ATTENDANCE_CONSTANTS.ALLOWED_PHOTO_TYPES;

    if (!allowedTypes.includes(photo.type as (typeof allowedTypes)[number])) {
      return {
        isValid: false,
        error: `Format file tidak didukung. Gunakan: ${allowedTypes.join(", ")}`,
      };
    }

    return { isValid: true };
  }

  /**
   * Validate file size
   */
  private validateFileSize(photo: File): PhotoValidationResult {
    const maxSize = ATTENDANCE_CONSTANTS.MAX_PHOTO_SIZE;

    if (photo.size > maxSize) {
      const maxSizeMB = maxSize / BYTES_PER_MEGABYTE;
      return {
        isValid: false,
        error: `Ukuran foto maksimal ${maxSizeMB}MB. Ukuran file Anda: ${(photo.size / BYTES_PER_MEGABYTE).toFixed(2)}MB`,
      };
    }

    if (photo.size === 0) {
      return {
        isValid: false,
        error: "File kosong atau rusak",
      };
    }

    return { isValid: true };
  }

  /**
   * Validate image dimensions
   */
  private validateDimensions(
    width: number,
    height: number,
  ): PhotoValidationResult {
    const maxDimension = ATTENDANCE_CONSTANTS.MAX_PHOTO_DIMENSION;
    const minDimension = ATTENDANCE_CONSTANTS.MIN_PHOTO_DIMENSION;

    if (width > maxDimension || height > maxDimension) {
      return {
        isValid: false,
        error: `Dimensi foto terlalu besar. Maksimal ${maxDimension}x${maxDimension}px`,
      };
    }

    if (width < minDimension || height < minDimension) {
      return {
        isValid: false,
        error: `Dimensi foto terlalu kecil. Minimal ${minDimension}x${minDimension}px`,
      };
    }

    return { isValid: true };
  }

  /**
   * Get human-readable file size
   */
  getReadableFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < BYTES_PER_MEGABYTE) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / BYTES_PER_MEGABYTE).toFixed(2)} MB`;
  }
}
