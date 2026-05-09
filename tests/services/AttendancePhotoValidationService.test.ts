/**
 * Unit tests for AttendancePhotoValidationService
 */

import { describe, it, expect, beforeEach } from "vitest";
import { AttendancePhotoValidationService } from "@/modules/attendance/services/AttendancePhotoValidationService";
import sharp from "sharp";

describe("AttendancePhotoValidationService", () => {
  let service: AttendancePhotoValidationService;

  beforeEach(() => {
    service = new AttendancePhotoValidationService();
  });

  describe("validatePhoto", () => {
    it("should accept valid JPEG photo", async () => {
      // Create a valid test image
      const buffer = await sharp({
        create: {
          width: 800,
          height: 600,
          channels: 3,
          background: { r: 255, g: 0, b: 0 },
        },
      })
        .jpeg()
        .toBuffer();

      const file = new File([new Uint8Array(buffer)], "test.jpg", {
        type: "image/jpeg",
      });

      const result = await service.validatePhoto(file);

      expect(result.isValid).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.width).toBe(800);
      expect(result.metadata?.height).toBe(600);
      expect(result.metadata?.format).toBe("jpeg");
    });

    it("should accept valid PNG photo", async () => {
      const buffer = await sharp({
        create: {
          width: 1024,
          height: 768,
          channels: 3,
          background: { r: 0, g: 255, b: 0 },
        },
      })
        .png()
        .toBuffer();

      const file = new File([new Uint8Array(buffer)], "test.png", {
        type: "image/png",
      });

      const result = await service.validatePhoto(file);

      expect(result.isValid).toBe(true);
      expect(result.metadata?.format).toBe("png");
    });

    it("should reject unsupported file type", async () => {
      const file = new File(["test"], "test.txt", { type: "text/plain" });

      const result = await service.validatePhoto(file);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Format file tidak didukung");
    });

    it("should reject file that is too large", async () => {
      // Create a 6MB buffer (exceeds 5MB limit)
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024);
      const file = new File([largeBuffer], "large.jpg", {
        type: "image/jpeg",
      });

      const result = await service.validatePhoto(file);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Ukuran foto maksimal");
    });

    it("should reject empty file", async () => {
      const file = new File([], "empty.jpg", { type: "image/jpeg" });

      const result = await service.validatePhoto(file);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("File kosong atau rusak");
    });

    it("should reject image with dimensions too small", async () => {
      const buffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .jpeg()
        .toBuffer();

      const file = new File([new Uint8Array(buffer)], "small.jpg", {
        type: "image/jpeg",
      });

      const result = await service.validatePhoto(file);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Dimensi foto terlalu kecil");
    });

    it("should reject image with dimensions too large", async () => {
      const buffer = await sharp({
        create: {
          width: 5000,
          height: 5000,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .jpeg()
        .toBuffer();

      const file = new File([new Uint8Array(buffer)], "huge.jpg", {
        type: "image/jpeg",
      });

      const result = await service.validatePhoto(file);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Dimensi foto terlalu besar");
    });

    it("should reject corrupted image file", async () => {
      const corruptedBuffer = Buffer.from("not an image");
      const file = new File([corruptedBuffer], "corrupt.jpg", {
        type: "image/jpeg",
      });

      const result = await service.validatePhoto(file);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("rusak atau format tidak didukung");
    });
  });

  describe("compressPhoto", () => {
    it("should compress large photo to specified dimensions", async () => {
      // Create a 2000x2000 image
      const buffer = await sharp({
        create: {
          width: 2000,
          height: 2000,
          channels: 3,
          background: { r: 255, g: 0, b: 0 },
        },
      })
        .jpeg()
        .toBuffer();

      const file = new File([new Uint8Array(buffer)], "large.jpg", {
        type: "image/jpeg",
      });

      const compressed = await service.compressPhoto(file, {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 85,
      });

      const metadata = await sharp(compressed).metadata();

      expect(metadata.width).toBeLessThanOrEqual(1920);
      expect(metadata.height).toBeLessThanOrEqual(1920);
      expect(metadata.format).toBe("webp");
    });

    it("should maintain aspect ratio when compressing", async () => {
      // Create a 2000x1000 image (2:1 ratio)
      const buffer = await sharp({
        create: {
          width: 2000,
          height: 1000,
          channels: 3,
          background: { r: 0, g: 255, b: 0 },
        },
      })
        .jpeg()
        .toBuffer();

      const file = new File([new Uint8Array(buffer)], "wide.jpg", {
        type: "image/jpeg",
      });

      const compressed = await service.compressPhoto(file, {
        maxWidth: 1920,
        maxHeight: 1920,
      });

      const metadata = await sharp(compressed).metadata();

      // Should maintain 2:1 aspect ratio
      const ratio = metadata.width! / metadata.height!;
      expect(ratio).toBeCloseTo(2, 1);
    });

    it("should not enlarge small images", async () => {
      // Create a 500x500 image
      const buffer = await sharp({
        create: {
          width: 500,
          height: 500,
          channels: 3,
          background: { r: 0, g: 0, b: 255 },
        },
      })
        .jpeg()
        .toBuffer();

      const file = new File([new Uint8Array(buffer)], "small.jpg", {
        type: "image/jpeg",
      });

      const compressed = await service.compressPhoto(file, {
        maxWidth: 1920,
        maxHeight: 1920,
      });

      const metadata = await sharp(compressed).metadata();

      // Should not be enlarged
      expect(metadata.width).toBeLessThanOrEqual(500);
      expect(metadata.height).toBeLessThanOrEqual(500);
    });

    it("should reduce file size significantly", async () => {
      // Create a large uncompressed image
      const buffer = await sharp({
        create: {
          width: 2000,
          height: 2000,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .png() // PNG is larger
        .toBuffer();

      const file = new File([new Uint8Array(buffer)], "large.png", {
        type: "image/png",
      });
      const originalSize = buffer.length;

      const compressed = await service.compressPhoto(file, {
        quality: 85,
      });

      // Compressed WebP should be significantly smaller
      expect(compressed.length).toBeLessThan(originalSize * 0.5);
    });
  });

  describe("getReadableFileSize", () => {
    it("should format bytes correctly", () => {
      expect(service.getReadableFileSize(500)).toBe("500 B");
    });

    it("should format kilobytes correctly", () => {
      expect(service.getReadableFileSize(1024)).toBe("1.00 KB");
      expect(service.getReadableFileSize(1536)).toBe("1.50 KB");
    });

    it("should format megabytes correctly", () => {
      expect(service.getReadableFileSize(1024 * 1024)).toBe("1.00 MB");
      expect(service.getReadableFileSize(5 * 1024 * 1024)).toBe("5.00 MB");
    });
  });
});
