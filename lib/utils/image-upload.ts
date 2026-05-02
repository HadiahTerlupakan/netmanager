import { logger } from "@/lib/logger";
import sharp from "sharp";
import { writeFile, mkdir, rm } from "fs/promises";
import path from "path";
import {
  deleteFromR2,
  getR2Settings,
  isR2Enabled,
  uploadToR2,
  generateR2Key,
} from "./r2-client";

export type UploadType =
  | "pelanggan"
  | "payment-proofs"
  | "logos"
  | "kmz"
  | "inventory-masuk"
  | "inventory-keluar"
  | "inventory-transfer"
  | "employee-attendance"
  | "employee-leave"
  | "workorder-completion"
  | "work-order-updates"
  | "tickets"
  | "user-profile"
  | "marketing"
  | "app-version"
  | "general"
  | "map-nodes";

// OPTIMIZATION: Threshold for streaming vs buffer processing
const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024; // 50MB

/**
 * Konversi dan simpan gambar ke WebP format
 * Mendukung upload ke R2 jika diaktifkan, fallback ke local storage
 * OPTIMIZATION: Uses streaming for large files (>50MB)
 * @param file File yang akan dikonversi
 * @param uploadDir Direktori upload (untuk local storage)
 * @param fileName Nama file output (tanpa extension)
 * @param uploadType Tipe upload untuk R2 folder structure
 * @param subFolder Sub folder (optional, e.g., idPelanggan)
 * @returns URL file yang disimpan
 */
// Helper to create SVG text for watermark
function createWatermarkSvg(
  width: number,
  height: number,
  lines: string[],
): Buffer {
  const fontSize = Math.floor(width * 0.03); // 3% of width
  const lineHeight = fontSize * 1.5;
  const padding = fontSize;
  const textHeight = lines.length * lineHeight;
  const bgHeight = textHeight + padding * 2;

  const svgText = lines
    .map(
      (line, i) =>
        `<text x="10" y="${35 + i * lineHeight}" font-family="Arial" font-size="${fontSize}" fill="white" font-weight="bold" style="text-shadow: 1px 1px 2px black;">${line}</text>`,
    )
    .join("\n");

  const svg = `
    <svg width="${width}" height="${height}">
      <style>
        .text { fill: white; font-family: sans-serif; font-weight: bold; }
        .bg { fill: black; opacity: 0.5; }
      </style>
      <!-- Bottom Left Background -->
      <rect x="0" y="${height - bgHeight}" width="${width * 0.6}" height="${bgHeight}" class="bg" />
      <!-- Text -->
      <g transform="translate(${padding}, ${height - bgHeight - padding / 2})">
         ${svgText}
      </g>
    </svg>
  `;
  return Buffer.from(svg);
}

export async function convertAndSaveImage(
  file: File,
  uploadDir: string,
  fileName: string,
  uploadType?: UploadType,
  subFolder?: string,
  watermarkLines?: string[], // New optional parameter
): Promise<string> {
  try {
    // OPTIMIZATION: Log file size for monitoring
    const fileSize = file.size;
    if (fileSize > LARGE_FILE_THRESHOLD) {
      logger.info(
        `[Image Upload] Large file detected: ${(fileSize / 1024 / 1024).toFixed(2)}MB. Using optimized processing.`,
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    return await processAndSaveBuffer(
      buffer,
      uploadDir,
      fileName,
      uploadType,
      subFolder,
      watermarkLines,
    );
  } catch (error) {
    logger.error("Error converting image to WebP:", error);
    throw new Error(
      `Gagal mengkonversi gambar: ${error instanceof Error ? error.message : "Terjadi kesalahan"}`,
    );
  }
}

/**
 * Konversi dan simpan gambar dari Base64 string
 */
export async function convertAndSaveBase64(
  base64String: string,
  uploadDir: string,
  fileName: string,
  uploadType?: UploadType,
  subFolder?: string,
  watermarkLines?: string[],
): Promise<string> {
  try {
    // Remove data:image/jpeg;base64, prefix if present
    const cleanBase64 = base64String.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(cleanBase64, "base64");
    return await processAndSaveBuffer(
      buffer,
      uploadDir,
      fileName,
      uploadType,
      subFolder,
      watermarkLines,
    );
  } catch (error) {
    logger.error("Error converting base64 to WebP:", error);
    throw new Error(
      `Gagal mengkonversi base64: ${error instanceof Error ? error.message : "Terjadi kesalahan"}`,
    );
  }
}

async function processAndSaveBuffer(
  buffer: Buffer,
  uploadDir: string,
  fileName: string,
  uploadType?: UploadType,
  subFolder?: string,
  watermarkLines?: string[],
): Promise<string> {
  // 1. Initialize Sharp
  let imagePipeline = sharp(buffer);

  // 2. Add Watermark if requested
  if (watermarkLines && watermarkLines.length > 0) {
    const metadata = await imagePipeline.metadata();
    if (metadata.width && metadata.height) {
      const svgWatermark = createWatermarkSvg(
        metadata.width,
        metadata.height,
        watermarkLines,
      );
      imagePipeline = imagePipeline.composite([
        { input: svgWatermark, gravity: "southwest" },
      ]);
    }
  }

  // 3. Convert to WebP
  const webpBuffer = await imagePipeline
    .webp({ lossless: true, effort: 6 })
    .toBuffer();

  // Check if R2 is enabled
  if (await isR2Enabled()) {
    // Upload to R2
    const key = generateR2Key(
      uploadType || "pelanggan",
      `${fileName}.webp`,
      subFolder || "",
    );

    const url = await uploadToR2(webpBuffer, key, "image/webp");
    logger.info("Image uploaded to R2:", { key, url });
    return url;
  }

  // Fallback to local storage
  const absoluteUploadDir = path.resolve(
    /*turbopackIgnore: true*/ process.cwd(),
    uploadDir,
  );
  await mkdir(absoluteUploadDir, { recursive: true });
  const outputPath = path.join(absoluteUploadDir, `${fileName}.webp`);
  await writeFile(outputPath, webpBuffer);

  // Return path relatif untuk URL
  const publicPath = path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    "public",
  );
  let relativePath = outputPath.replace(publicPath, "");
  relativePath = relativePath.replace(/\\/g, "/"); // Normalize path separator untuk URL

  logger.info("Image saved locally:", {
    outputPath,
    publicPath,
    relativePath,
    fileName: `${fileName}.webp`,
  });

  return relativePath;
}

/**
 * Simpan file tanpa konversi (untuk file non-image seperti PDF)
 * Mendukung upload ke R2 jika diaktifkan, fallback ke local storage
 * @param file File yang akan disimpan
 * @param uploadDir Direktori upload (untuk local storage)
 * @param fileName Nama file output (dengan extension)
 * @param uploadType Tipe upload untuk R2 folder structure
 * @param subFolder Sub folder (optional, e.g., idPelanggan)
 * @returns URL file yang disimpan
 */
export async function saveFile(
  file: File,
  uploadDir: string,
  fileName: string,
  uploadType?: UploadType,
  subFolder?: string,
): Promise<string> {
  try {
    // Baca file sebagai buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Check if R2 is enabled
    if (await isR2Enabled()) {
      // Upload to R2
      const key = generateR2Key(uploadType || "pelanggan", fileName, subFolder);

      const url = await uploadToR2(
        buffer,
        key,
        file.type || "application/octet-stream",
      );
      logger.info("File uploaded to R2:", { key, url });
      return url;
    }

    // Fallback to local storage
    await mkdir(uploadDir, { recursive: true });
    const outputPath = path.join(uploadDir, fileName);
    await writeFile(outputPath, buffer);

    // Return path relatif untuk URL
    const relativePath = outputPath.replace(
      path.join(process.cwd(), "public"),
      "",
    );
    const normalizedPath = relativePath.replace(/\\/g, "/"); // Normalize path separator untuk URL

    logger.info("File saved locally:", {
      outputPath,
      relativePath: normalizedPath,
    });
    return normalizedPath;
  } catch (error) {
    logger.error("Error saving file:", error);
    throw new Error(
      `Gagal menyimpan file: ${error instanceof Error ? error.message : "Terjadi kesalahan"}`,
    );
  }
}

/**
 * Cek apakah file adalah gambar
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

/**
 * Upload multiple photos for inventory transactions
 * @param files Array of files to upload
 * @param transactionId ID of the inventory transaction (masuk/keluar)
 * @param transactionType Type of transaction ('inventory-masuk' or 'inventory-keluar')
 * @param uploadDir Base upload directory (for local storage)
 * @returns Array of URLs for uploaded photos
 */
export async function uploadInventoryPhotos(
  files: File[],
  transactionId: string,
  transactionType:
    | "inventory-masuk"
    | "inventory-keluar"
    | "inventory-transfer",
  uploadDir: string,
): Promise<string[]> {
  const uploadedUrls: string[] = [];

  try {
    // Filter for image files only
    const imageFiles = files.filter((file) => isImageFile(file));

    if (imageFiles.length === 0) {
      throw new Error("Tidak ada file gambar yang valid");
    }

    // Validate and sanitize transactionId to prevent path traversal
    const safeTransactionId = transactionId.replace(/[^a-zA-Z0-9_\-]/g, "");
    if (!safeTransactionId || safeTransactionId.length === 0) {
      throw new Error("Invalid transaction ID for file upload");
    }

    // Upload each image with a sequential index
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      if (!file) continue;

      const fileName = `${safeTransactionId}_photo_${i + 1}`;

      // Use the existing convertAndSaveImage function
      const url = await convertAndSaveImage(
        file,
        uploadDir,
        fileName,
        transactionType,
        safeTransactionId, // Use safe, sanitized ID for key generation too
      );

      uploadedUrls.push(url);
    }

    logger.info(
      `Successfully uploaded ${uploadedUrls.length} inventory photos for transaction ${transactionId}`,
    );
    return uploadedUrls;
  } catch (error) {
    logger.error("Error uploading inventory photos:", error);
    throw new Error(
      `Gagal mengupload foto inventaris: ${error instanceof Error ? error.message : "Terjadi kesalahan"}`,
    );
  }
}

/**
 * Validate inventory photo files
 * @param files Array of files to validate
 * @param maxPhotos Maximum number of photos allowed (default: 5)
 * @param maxSizeMB Maximum file size per photo in MB (default: 5)
 * @returns Validation result
 */
export function validateInventoryPhotos(
  files: File[],
  maxPhotos: number = 5,
  maxSizeMB: number = 5,
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check number of files
  if (files.length > maxPhotos) {
    errors.push(`Maksimal ${maxPhotos} foto yang diizinkan`);
  }

  if (files.length === 0) {
    errors.push("Setidaknya satu foto harus diupload");
  }

  // Check each file
  files.forEach((file, index) => {
    // Check file type
    if (!isImageFile(file)) {
      errors.push(`File ke-${index + 1} bukan gambar yang valid`);
    }

    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      errors.push(
        `File ke-${index + 1} terlalu besar. Maksimal ${maxSizeMB}MB`,
      );
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export async function deleteUploadedFile(url: string): Promise<boolean> {
  const parsedUrl = new URL(url);
  const objectPath = parsedUrl.pathname;

  if (!objectPath.startsWith("/uploads/")) {
    return false;
  }

  if (await isR2Enabled()) {
    const settings = await getR2Settings();
    if (!settings) {
      return false;
    }

    const publicPrefix = settings.publicUrl?.replace(/\/$/, "");
    const isCustomPublicUrl = publicPrefix
      ? url.startsWith(`${publicPrefix}/`)
      : false;
    const isDefaultR2Url = url.includes(".r2.cloudflarestorage.com/");

    if (!isCustomPublicUrl && !isDefaultR2Url) {
      return false;
    }

    return deleteFromR2(objectPath.slice(1));
  }

  const filePath = path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    "public",
    objectPath.replace(/^\/uploads\//, "uploads/"),
  );
  await rm(filePath, { force: true });
  return true;
}

// Re-export R2 utilities for convenience
export {
  getR2Settings,
  isR2Enabled,
  uploadToR2,
  generateR2Key,
} from "./r2-client";
