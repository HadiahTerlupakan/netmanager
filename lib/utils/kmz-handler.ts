import { logger } from "@/lib/logger";
import AdmZip from "adm-zip";
import { promises as fs } from "fs";
import path from "path";
import { isR2Enabled, uploadToR2, deleteFromR2 } from "./r2-client";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "kmz");

// Ensure upload directory exists
export async function ensureUploadDir() {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  } catch (error) {
    logger.error("Error creating upload directory:", error);
    throw new Error("Failed to create upload directory");
  }
}

// Validate KMZ file
export function validateKmzFile(file: File): {
  valid: boolean;
  error?: string;
} {
  // Check file extension
  if (!file.name.toLowerCase().endsWith(".kmz")) {
    return { valid: false, error: "File harus berformat KMZ" };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File terlalu besar. Maksimal ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  if (file.size === 0) {
    return { valid: false, error: "File tidak boleh kosong" };
  }

  return { valid: true };
}

// Extract KMZ and save files
export async function extractAndSaveKmz(
  fileBuffer: Buffer,
  kmzId: string,
  _originalFilename: string,
): Promise<{ filePath: string; kmlPath: string; fileSize: number }> {
  // Check if R2 is enabled
  const r2Enabled = await isR2Enabled();

  // Prepare R2 keys if enabled
  const r2BasePath = `uploads/kmz/${kmzId}`;

  if (r2Enabled) {
    logger.info("R2 is enabled, processing KMZ for R2 upload...");

    // 1. Upload original KMZ to R2
    const kmzKey = `${r2BasePath}/original.kmz`;
    await uploadToR2(fileBuffer, kmzKey, "application/vnd.google-earth.kmz");

    // 2. Extract KMZ
    const zip = new AdmZip(fileBuffer);
    const zipEntries = zip.getEntries();

    // Find KML file in the zip
    let kmlEntry = zipEntries.find((entry) =>
      entry.entryName.toLowerCase().endsWith(".kml"),
    );

    if (!kmlEntry) {
      kmlEntry = zipEntries.find(
        (entry) =>
          entry.entryName.toLowerCase() === "doc.kml" ||
          entry.entryName.toLowerCase().endsWith("/doc.kml"),
      );
    }

    if (!kmlEntry) {
      throw new Error("File KML tidak ditemukan dalam file KMZ");
    }

    // Extract KML content
    let kmlContent = zip.readAsText(kmlEntry);

    // Process KML content (clean up)
    kmlContent = kmlContent.replace(
      /<href>https?:\/\/[^<]*<\/href>/gi,
      "<href></href>",
    );
    kmlContent = kmlContent.replace(
      /<href><!\[CDATA\[https?:\/\/[^\]]*\]\]><\/href>/gi,
      "<href></href>",
    );
    kmlContent = kmlContent.replace(
      /https?:\/\/earth\.google\.com\/earth\/document\/icon[^\s<]*<!\[CDATA\[&\]\][^\s<]*/gi,
      "",
    );
    kmlContent = kmlContent.replace(
      /<IconStyle>[\s\S]*?<href>https?:\/\/[^<]*<\/href>[\s\S]*?<\/IconStyle>/gi,
      "<IconStyle></IconStyle>",
    );
    kmlContent = kmlContent.replace(
      /<IconStyle>[\s\S]*?<href><!\[CDATA\[https?:\/\/[^\]]*\]\]><\/href>[\s\S]*?<\/IconStyle>/gi,
      "<IconStyle></IconStyle>",
    );
    kmlContent = kmlContent.replace(
      /<IconStyle>[\s\S]*?https?:\/\/[\s\S]*?<\/IconStyle>/gi,
      "<IconStyle></IconStyle>",
    );
    kmlContent = kmlContent.replace(
      /<styleUrl>#[^<]*<\/styleUrl>/gi,
      "<styleUrl></styleUrl>",
    );
    kmlContent = kmlContent.replace(
      /<icon>https?:\/\/[^<]*<\/icon>/gi,
      "<icon></icon>",
    );

    // 3. Upload extracted KML to R2
    const kmlKey = `${r2BasePath}/doc.kml`;
    const kmlBuffer = Buffer.from(kmlContent, "utf-8");
    await uploadToR2(kmlBuffer, kmlKey, "application/vnd.google-earth.kml+xml");

    // Return keys/paths (consistent with what GET route expects)
    // We return relative paths so the GET route logic can prepend proper Base URL
    return {
      filePath: `/${kmzKey}`, // /uploads/kmz/...
      kmlPath: `/${kmlKey}`, // /uploads/kmz/...
      fileSize: fileBuffer.length,
    };
  }

  // Fallback to Local Storage
  logger.info("R2 disabled, saving locally...");
  await ensureUploadDir();

  const kmzDir = path.join(UPLOAD_DIR, kmzId);
  await fs.mkdir(kmzDir, { recursive: true });

  // Save original KMZ file
  const kmzFilePath = path.join(kmzDir, "original.kmz");
  await fs.writeFile(kmzFilePath, fileBuffer);

  // Extract KMZ
  const zip = new AdmZip(fileBuffer);
  const zipEntries = zip.getEntries();

  // Find KML file in the zip
  let kmlEntry = zipEntries.find((entry) =>
    entry.entryName.toLowerCase().endsWith(".kml"),
  );

  if (!kmlEntry) {
    // If no .kml file found, try to find doc.kml (common in KMZ files)
    kmlEntry = zipEntries.find(
      (entry) =>
        entry.entryName.toLowerCase() === "doc.kml" ||
        entry.entryName.toLowerCase().endsWith("/doc.kml"),
    );
  }

  if (!kmlEntry) {
    throw new Error("File KML tidak ditemukan dalam file KMZ");
  }

  // Extract KML content
  let kmlContent = zip.readAsText(kmlEntry);

  // Remove external icon references to prevent CORS errors
  // This regex removes all <href> tags containing http:// or https:// URLs
  // It handles both <Icon><href>...</href></Icon> and standalone <href>...</href> patterns
  kmlContent = kmlContent.replace(
    /<href>https?:\/\/[^<]*<\/href>/gi,
    "<href></href>",
  );

  // Handle CDATA sections with URLs
  // Remove URLs wrapped in CDATA sections
  kmlContent = kmlContent.replace(
    /<href><!\[CDATA\[https?:\/\/[^\]]*\]\]><\/href>/gi,
    "<href></href>",
  );

  // Remove Google Earth specific icon URLs with CDATA
  kmlContent = kmlContent.replace(
    /https?:\/\/earth\.google\.com\/earth\/document\/icon[^\s<]*<!\[CDATA\[&\]\][^\s<]*/gi,
    "",
  );

  // Remove IconStyle blocks that contain external URLs
  // This uses a more robust pattern to match IconStyle blocks with external hrefs
  kmlContent = kmlContent.replace(
    /<IconStyle>[\s\S]*?<href>https?:\/\/[^<]*<\/href>[\s\S]*?<\/IconStyle>/gi,
    "<IconStyle></IconStyle>",
  );

  // Remove IconStyle blocks with CDATA URLs
  kmlContent = kmlContent.replace(
    /<IconStyle>[\s\S]*?<href><!\[CDATA\[https?:\/\/[^\]]*\]\]><\/href>[\s\S]*?<\/IconStyle>/gi,
    "<IconStyle></IconStyle>",
  );

  // Remove all IconStyle blocks that reference external resources
  kmlContent = kmlContent.replace(
    /<IconStyle>[\s\S]*?https?:\/\/[\s\S]*?<\/IconStyle>/gi,
    "<IconStyle></IconStyle>",
  );

  // Remove styleUrl references that might point to external styles
  kmlContent = kmlContent.replace(
    /<styleUrl>#[^<]*<\/styleUrl>/gi,
    "<styleUrl></styleUrl>",
  );

  // Also remove any remaining external URLs in icon-related tags
  kmlContent = kmlContent.replace(
    /<icon>https?:\/\/[^<]*<\/icon>/gi,
    "<icon></icon>",
  );

  const kmlPath = path.join(kmzDir, "doc.kml");
  await fs.writeFile(kmlPath, kmlContent, "utf-8");

  return {
    filePath: `/uploads/kmz/${kmzId}/original.kmz`,
    kmlPath: `/uploads/kmz/${kmzId}/doc.kml`,
    fileSize: fileBuffer.length,
  };
}

// Delete KMZ files and directory
export async function deleteKmzFiles(kmzId: string): Promise<void> {
  try {
    // 1. Delete from R2 if enabled
    if (await isR2Enabled()) {
      logger.info(`R2 is enabled, deleting KMZ files from R2 for ${kmzId}...`);
      await deleteFromR2(`uploads/kmz/${kmzId}/original.kmz`);
      await deleteFromR2(`uploads/kmz/${kmzId}/doc.kml`);
    }

    // 2. Delete from local storage
    const kmzDir = path.join(UPLOAD_DIR, kmzId);
    await fs.rm(kmzDir, { recursive: true, force: true });
  } catch (error) {
    logger.error(`Error deleting KMZ files for ${kmzId}:`, error);
    // Don't throw error, just log it
  }
}

// Get file buffer from FormData - optimized for large files
export async function getFileBuffer(
  formData: FormData,
  fieldName: string,
  options?: { onProgress?: (loaded: number, total: number) => void },
): Promise<Buffer> {
  // Use stream processor for memory-efficient large file handling
  const { getFileWithProgress } = await import("./stream-processor");
  const { buffer } = await getFileWithProgress(formData, fieldName, {
    streamThreshold: 10 * 1024 * 1024, // 10MB threshold
    ...(options?.onProgress ? { onProgress: options.onProgress } : {}),
  });
  return buffer;
}
