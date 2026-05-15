import { logger } from "@/lib/logger";
import {
  S3Client,
  HeadBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  type _Object,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prismaAuth } from "@/lib/prisma";
import { decryptApiKey } from "@/lib/utils/encryption";

// R2 Settings interface
export interface R2Settings {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
  enabled: boolean;
}

// Cache for R2 settings
let r2SettingsCache: R2Settings | null = null;
let r2SettingsCacheTime: number = 0;
const R2_SETTINGS_CACHE_TTL = 60000; // 1 minute cache
const ENCRYPTED_SECRET_PATTERN = /^[0-9a-f]{32}:[0-9a-f]+$/i;

function normalizePublicBaseUrl(publicUrl: string | null): string | null {
  const normalizedPublicUrl = publicUrl?.trim();
  if (!normalizedPublicUrl) {
    return null;
  }

  return normalizedPublicUrl.replace(/\/$/, "");
}

/**
 * Get R2 settings from database
 */
function shouldDecryptSecretAccessKey(secretAccessKey: string): boolean {
  return ENCRYPTED_SECRET_PATTERN.test(secretAccessKey);
}

export async function getR2PublicBaseUrl(): Promise<string | null> {
  try {
    const publicUrl = await prismaAuth.settings.findFirst({
      where: { key: "R2_PUBLIC_URL" },
      select: { value: true },
    });

    return normalizePublicBaseUrl(publicUrl?.value ?? null);
  } catch (error) {
    logger.error("Error fetching R2 public URL:", error);
    return null;
  }
}

export async function getR2Settings(): Promise<R2Settings | null> {
  // Check cache first
  if (
    r2SettingsCache &&
    Date.now() - r2SettingsCacheTime < R2_SETTINGS_CACHE_TTL
  ) {
    return r2SettingsCache;
  }

  try {
    const settings = await prismaAuth.settings.findMany({
      where: {
        key: {
          in: [
            "R2_ACCOUNT_ID",
            "R2_ACCESS_KEY_ID",
            "R2_SECRET_ACCESS_KEY",
            "R2_BUCKET_NAME",
            "R2_PUBLIC_URL",
            "R2_ENABLED",
          ],
        },
      },
    });

    const settingsMap = new Map(settings.map((s) => [s.key, s.value]));
    const settingsRecordMap = new Map(settings.map((s) => [s.key, s]));

    // Check if all required settings are present
    const accountId = settingsMap.get("R2_ACCOUNT_ID");
    const accessKeyId = settingsMap.get("R2_ACCESS_KEY_ID");
    const storedSecretAccessKey = settingsMap.get("R2_SECRET_ACCESS_KEY");
    const secretRecord = settingsRecordMap.get("R2_SECRET_ACCESS_KEY");
    const bucketName = settingsMap.get("R2_BUCKET_NAME");
    const publicUrl = settingsMap.get("R2_PUBLIC_URL");
    const enabled = settingsMap.get("R2_ENABLED");

    if (!accountId || !accessKeyId || !storedSecretAccessKey || !bucketName) {
      return null;
    }

    let secretAccessKey = storedSecretAccessKey;
    if (
      secretRecord?.encrypted &&
      shouldDecryptSecretAccessKey(storedSecretAccessKey)
    ) {
      try {
        secretAccessKey = decryptApiKey(storedSecretAccessKey);
      } catch (error) {
        logger.error("Error decrypting R2 secret access key:", error);
        return null;
      }
    }

    const r2Settings: R2Settings = {
      accountId,
      accessKeyId,
      secretAccessKey,
      bucketName,
      publicUrl: publicUrl || "",
      enabled: enabled === "true",
    };

    // Update cache
    r2SettingsCache = r2Settings;
    r2SettingsCacheTime = Date.now();

    return r2Settings;
  } catch (error) {
    logger.error("Error fetching R2 settings:", error);
    return null;
  }
}

/**
 * Clear R2 settings cache
 */
export function clearR2SettingsCache(): void {
  r2SettingsCache = null;
  r2SettingsCacheTime = 0;
}

/**
 * Check if R2 storage is enabled and properly configured
 */
export async function isR2Enabled(): Promise<boolean> {
  const settings = await getR2Settings();
  return settings?.enabled === true;
}

/**
 * Get configured S3 client for Cloudflare R2
 */
export async function getR2Client(): Promise<S3Client | null> {
  const settings = await getR2Settings();

  if (!settings || !settings.enabled) {
    return null;
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${settings.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
    },
    forcePathStyle: true,
    // R2 belum support flexible checksums dari SDK v3 default ("WHEN_SUPPORTED").
    // Tanpa override ini, presigned URL ikut menyertakan x-amz-sdk-checksum-algorithm
    // ke SignedHeaders → browser PUT direct ditolak (403 SignatureDoesNotMatch).
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

  return client;
}

/**
 * Test R2 connection with given credentials
 */
export async function testR2Connection(
  settings: Omit<R2Settings, "enabled">,
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = new S3Client({
      region: "auto",
      endpoint: `https://${settings.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: settings.accessKeyId,
        secretAccessKey: settings.secretAccessKey,
      },
      forcePathStyle: true,
    });

    // Try to head the bucket to verify access
    await client.send(
      new HeadBucketCommand({
        Bucket: settings.bucketName,
      }),
    );

    return { success: true };
  } catch (error) {
    logger.error("R2 connection test failed:", error);

    const err = error as { name?: string; Code?: string; message?: string };
    let errorMessage = "Koneksi ke R2 gagal";
    if (err.name === "NoSuchBucket") {
      errorMessage = "Bucket tidak ditemukan";
    } else if (err.name === "AccessDenied" || err.Code === "AccessDenied") {
      errorMessage = "Akses ditolak. Periksa kredensial Anda.";
    } else if (err.name === "InvalidAccessKeyId") {
      errorMessage = "Access Key ID tidak valid";
    } else if (err.name === "SignatureDoesNotMatch") {
      errorMessage = "Secret Access Key tidak valid";
    } else if (err.message) {
      errorMessage = err.message;
    }

    return { success: false, error: errorMessage };
  }
}

/**
 * Generate a presigned URL for direct upload to R2
 * @param key Object key (path in bucket)
 * @param contentType MIME type of the file
 * @param expiresIn Expiration time in seconds (default: 3600 / 1 hour)
 * @param contentDisposition Optional Content-Disposition header for the object
 * @returns Object containing presigned URL and the final public URL
 */
export async function getPresignedUrl(
  key: string,
  contentType: string,
  expiresIn = 3600,
  contentDisposition?: string,
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const settings = await getR2Settings();

  if (!settings || !settings.enabled) {
    throw new Error("R2 storage is not enabled");
  }

  const client = await getR2Client();
  if (!client) {
    throw new Error("Failed to create R2 client");
  }

  try {
    const command = new PutObjectCommand({
      Bucket: settings.bucketName,
      Key: key,
      ContentType: contentType,
      ...(contentDisposition && { ContentDisposition: contentDisposition }),
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn });

    // Calculate public URL
    let publicUrl = "";
    if (settings.publicUrl) {
      publicUrl = `${settings.publicUrl.replace(/\/$/, "")}/${key}`;
    } else {
      publicUrl = `https://${settings.bucketName}.${settings.accountId}.r2.cloudflarestorage.com/${key}`;
    }

    return { uploadUrl, publicUrl };
  } catch (error) {
    logger.error("Error generating presigned URL:", error);
    throw new Error("Gagal membuat presigned URL");
  }
}

/**
 * Upload file to R2 bucket
 * @param buffer File buffer to upload
 * @param key Object key (path in bucket)
 * @param contentType MIME type of the file
 * @param contentDisposition Optional Content-Disposition header for the object
 * @returns Public URL of the uploaded file
 */
export async function uploadToR2(
  buffer: Buffer,
  key: string,
  contentType: string,
  contentDisposition?: string,
): Promise<string> {
  const settings = await getR2Settings();

  if (!settings || !settings.enabled) {
    throw new Error("R2 storage is not enabled");
  }

  const client = await getR2Client();
  if (!client) {
    throw new Error("Failed to create R2 client");
  }

  try {
    // Use Upload for better handling of larger files
    const upload = new Upload({
      client,
      params: {
        Bucket: settings.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ...(contentDisposition && { ContentDisposition: contentDisposition }),
      },
    });

    await upload.done();

    // Return the public URL
    if (settings.publicUrl) {
      // Custom domain or R2.dev URL
      return `${settings.publicUrl.replace(/\/$/, "")}/${key}`;
    } else {
      // Default R2.dev URL
      return `https://${settings.bucketName}.${settings.accountId}.r2.cloudflarestorage.com/${key}`;
    }
  } catch (error) {
    logger.error("Error uploading to R2:", error);
    const err = error as Error;
    throw new Error(`Gagal mengupload file ke R2: ${err.message}`);
  }
}

/**
 * Delete file from R2 bucket
 * @param key Object key to delete
 */
export async function deleteFromR2(key: string): Promise<boolean> {
  const client = await getR2Client();
  const settings = await getR2Settings();

  if (!client || !settings) {
    return false;
  }

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: settings.bucketName,
        Key: key,
      }),
    );
    return true;
  } catch (error) {
    logger.error("Error deleting from R2:", error);
    return false;
  }
}

export interface R2ObjectMetadata {
  contentLength: number | null;
  contentType: string | null;
}

export async function hasR2Object(key: string): Promise<boolean> {
  const client = await getR2Client();
  const settings = await getR2Settings();

  if (!client || !settings) {
    return false;
  }

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: settings.bucketName,
        Key: key,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export async function findLatestR2ObjectKeyByFilename(
  filename: string,
): Promise<string | null> {
  const client = await getR2Client();
  const settings = await getR2Settings();

  if (!client || !settings) {
    return null;
  }

  const normalizedFilename = filename.trim();
  if (!normalizedFilename) {
    return null;
  }

  const result = await client.send(
    new ListObjectsV2Command({
      Bucket: settings.bucketName,
      Prefix: "uploads/logos/",
    }),
  );

  const latestMatch = (result.Contents ?? [])
    .filter((item) => item.Key?.endsWith(`-${normalizedFilename}`))
    .sort((left, right) => {
      const leftTime = left.LastModified?.getTime() ?? 0;
      const rightTime = right.LastModified?.getTime() ?? 0;
      return rightTime - leftTime;
    })[0];

  return latestMatch?.Key ?? null;
}

export async function getR2ObjectMetadata(
  key: string,
): Promise<R2ObjectMetadata> {
  const client = await getR2Client();
  const settings = await getR2Settings();

  if (!client || !settings) {
    throw new Error("R2 storage is not enabled");
  }

  try {
    const result = await client.send(
      new HeadObjectCommand({
        Bucket: settings.bucketName,
        Key: key,
      }),
    );

    return {
      contentLength: result.ContentLength ?? null,
      contentType: result.ContentType ?? null,
    };
  } catch (error) {
    logger.error("Error reading R2 object metadata:", error);
    throw new Error("File APK yang diupload tidak ditemukan di R2");
  }
}

export async function getR2ObjectBuffer(key: string): Promise<Buffer> {
  const client = await getR2Client();
  const settings = await getR2Settings();

  if (!client || !settings) {
    throw new Error("R2 storage is not enabled");
  }

  try {
    const result = await client.send(
      new GetObjectCommand({
        Bucket: settings.bucketName,
        Key: key,
      }),
    );

    const body = result.Body;
    if (!body || typeof body.transformToByteArray !== "function") {
      throw new Error("Konten file APK tidak tersedia");
    }

    const bytes = await body.transformToByteArray();
    return Buffer.from(bytes);
  } catch (error) {
    logger.error("Error downloading object from R2:", error);
    throw new Error("Gagal membaca file APK yang sudah diupload ke R2");
  }
}

/**
 * Stream an R2 object directly to disk. Pakai ini untuk file besar (APK 300MB+)
 * agar memori server tidak spike — body di-pipe per chunk, bukan di-load penuh.
 */
export async function streamR2ObjectToFile(
  key: string,
  destinationPath: string,
): Promise<void> {
  const client = await getR2Client();
  const settings = await getR2Settings();

  if (!client || !settings) {
    throw new Error("R2 storage is not enabled");
  }

  const { createWriteStream } = await import("fs");
  const { pipeline } = await import("stream/promises");
  const { Readable } = await import("stream");

  try {
    const result = await client.send(
      new GetObjectCommand({
        Bucket: settings.bucketName,
        Key: key,
      }),
    );

    const body = result.Body as
      | NodeJS.ReadableStream
      | ReadableStream<Uint8Array>
      | undefined;
    if (!body) {
      throw new Error("Konten file APK tidak tersedia");
    }

    const nodeStream =
      body instanceof Readable ? body : Readable.fromWeb(body as never);

    await pipeline(nodeStream, createWriteStream(destinationPath));
  } catch (error) {
    logger.error("Error streaming object from R2 to file:", error);
    throw new Error("Gagal mengunduh file APK dari R2");
  }
}

/**
 * Generate upload key for different upload types
 */
export function generateR2Key(
  type:
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
    | "app-version"
    | "marketing"
    | "general"
    | "map-nodes",
  filename: string,
  subFolder?: string,
): string {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");

  switch (type) {
    case "pelanggan":
      if (subFolder) {
        return `uploads/pelanggan/${subFolder}/${timestamp}-${sanitizedFilename}`;
      }
      return `uploads/pelanggan/${timestamp}-${sanitizedFilename}`;
    case "payment-proofs":
      return `uploads/payment-proofs/${timestamp}-${sanitizedFilename}`;
    case "logos":
      return `uploads/logos/${timestamp}-${sanitizedFilename}`;
    case "kmz":
      return `uploads/kmz/${timestamp}-${sanitizedFilename}`;
    case "inventory-masuk":
      if (subFolder) {
        return `uploads/inventory/masuk/${subFolder}/${timestamp}-${sanitizedFilename}`;
      }
      return `uploads/inventory/masuk/${timestamp}-${sanitizedFilename}`;
    case "inventory-keluar":
      if (subFolder) {
        return `uploads/inventory/keluar/${subFolder}/${timestamp}-${sanitizedFilename}`;
      }
      return `uploads/inventory/keluar/${timestamp}-${sanitizedFilename}`;
    case "inventory-transfer":
      if (subFolder) {
        return `uploads/inventory/transfer/${subFolder}/${timestamp}-${sanitizedFilename}`;
      }
      return `uploads/inventory/transfer/${timestamp}-${sanitizedFilename}`;
    case "employee-attendance":
      if (subFolder) {
        return `uploads/employee/attendance/${subFolder}/${timestamp}-${sanitizedFilename}`;
      }
      return `uploads/employee/attendance/${timestamp}-${sanitizedFilename}`;
    case "workorder-completion":
      if (subFolder) {
        return `uploads/workorder/completion/${subFolder}/${timestamp}-${sanitizedFilename}`;
      }
      return `uploads/workorder/completion/${timestamp}-${sanitizedFilename}`;
    case "work-order-updates":
      if (subFolder) {
        return `uploads/workorder/updates/${subFolder}/${timestamp}-${sanitizedFilename}`;
      }
      return `uploads/workorder/updates/${timestamp}-${sanitizedFilename}`;
    case "tickets":
      if (subFolder) {
        return `uploads/tickets/${subFolder}/${timestamp}-${sanitizedFilename}`;
      }
      return `uploads/tickets/${timestamp}-${sanitizedFilename}`;
    case "employee-leave":
      if (subFolder) {
        return `uploads/employee/leave/${subFolder}/${timestamp}-${sanitizedFilename}`;
      }
      return `uploads/employee/leave/${timestamp}-${sanitizedFilename}`;
    case "user-profile":
      if (subFolder) {
        return `uploads/user-profile/${subFolder}/${timestamp}-${sanitizedFilename}`;
      }
      return `uploads/user-profile/${timestamp}-${sanitizedFilename}`;
    case "app-version":
      return `uploads/apk/${timestamp}-${sanitizedFilename}`;
    case "marketing":
      if (subFolder) {
        return `uploads/marketing/${subFolder}/${timestamp}-${sanitizedFilename}`;
      }
      return `uploads/marketing/${timestamp}-${sanitizedFilename}`;
    case "map-nodes":
      if (subFolder) {
        return `uploads/map-nodes/${subFolder}/${timestamp}-${sanitizedFilename}`;
      }
      return `uploads/map-nodes/${timestamp}-${sanitizedFilename}`;
    default:
      return `uploads/${timestamp}-${sanitizedFilename}`;
  }
}
