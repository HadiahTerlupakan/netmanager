import { randomUUID } from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";

import { logger } from "@/lib/logger";
import {
  deleteFromR2 as deleteR2Object,
  generateR2Key,
  getPresignedUrl,
  getR2ObjectBuffer,
  getR2ObjectMetadata,
  getR2Settings,
  isR2Enabled,
  uploadToR2,
} from "@/lib/utils/r2-client";

import type { UploadVersionInput } from "./AppVersionService";

interface ApkManifest {
  versionCode: number;
  versionName: string;
  package: string;
}

export interface ParsedApkInfo {
  versionName: string;
  versionCode: number;
  packageName: string;
  buildNumber: number;
}

const DIRECT_UPLOAD_PREFIX = "uploads/apk/";
const APK_CONTENT_TYPE = "application/vnd.android.package-archive";
const PRESIGNED_EXPIRES_IN = 3600;

/** Validate direct-upload key before reading object details. */
export function validateUploadedKey(key: string) {
  if (!key.startsWith(DIRECT_UPLOAD_PREFIX)) {
    throw new Error("Lokasi file direct upload tidak valid");
  }
}

/** Remove a previously stored APK from local disk or R2. */
export async function deleteUploadedApkObject(key: string) {
  await deleteR2Object(key);
}

export async function cleanupStoredApk(apkUrl?: string | null): Promise<void> {
  if (!apkUrl) {
    return;
  }

  if (apkUrl.startsWith("/uploads/apk/") || apkUrl.startsWith("/apk/")) {
    const relativePath = apkUrl.replace(/^\//, "");
    const localPath = path.join(process.cwd(), "public", relativePath);
    await fs.unlink(localPath);
    return;
  }

  if (!/^https?:\/\//.test(apkUrl) || !apkUrl.includes(DIRECT_UPLOAD_PREFIX)) {
    return;
  }

  const keyIndex = apkUrl.indexOf(DIRECT_UPLOAD_PREFIX);
  if (keyIndex !== -1) {
    await deleteR2Object(apkUrl.substring(keyIndex));
  }
}

/** Load uploaded APK buffer, URL, and validated size from R2. */
export interface UploadedApkDetails {
  apkBuffer?: Buffer;
  apkSize?: number;
  apkUrl?: string;
}

export async function loadUploadedApkDetails(
  input: UploadVersionInput,
): Promise<UploadedApkDetails> {
  if (!input.uploadedKey) {
    return {};
  }

  validateUploadedKey(input.uploadedKey);
  const metadata = await getR2ObjectMetadata(input.uploadedKey);

  if (
    input.uploadedSize &&
    metadata.contentLength !== null &&
    input.uploadedSize !== metadata.contentLength
  ) {
    throw new Error("Ukuran file APK yang diupload tidak sesuai");
  }

  const settings = await getR2Settings();
  const apkUrl = buildUploadedApkUrl(input.uploadedKey, settings);
  const resolvedSize = metadata.contentLength ?? input.uploadedSize;
  const apkBuffer = await getR2ObjectBuffer(input.uploadedKey);

  return {
    apkBuffer,
    ...(resolvedSize ? { apkSize: resolvedSize } : {}),
    apkUrl,
  };
}

/** Persist uploaded File into a temporary path for APK parsing or upload. */
export async function persistApkFileToTemp(apkFile: File) {
  const fileExtension = path.extname(apkFile.name);
  const tempPath = path.join(
    os.tmpdir(),
    `apk_upload_${randomUUID()}${fileExtension}`,
  );
  const arrayBuffer = await apkFile.arrayBuffer();
  await fs.writeFile(tempPath, Buffer.from(arrayBuffer));

  return { path: tempPath, filename: apkFile.name, size: apkFile.size };
}

/** Parse APK metadata from a temp path or buffer. */
export async function parseApkInfo(input: {
  buffer?: Buffer;
  path?: string;
}): Promise<ParsedApkInfo | null> {
  let tempFilePath: string | null = null;

  try {
    const apkReaderModule = await import("adbkit-apkreader");
    const ApkReader = apkReaderModule.default || apkReaderModule;
    tempFilePath = await resolveApkTempPath(input);

    if (!tempFilePath) {
      logger.warn("[AppVersionService] No APK buffer or path provided");
      return null;
    }

    const reader = await ApkReader.open(tempFilePath);
    const manifest = (await reader.readManifest()) as ApkManifest;
    return buildParsedApkInfo(manifest);
  } catch (error: unknown) {
    logApkParseError(error);
    return null;
  } finally {
    await cleanupTempApkFile(tempFilePath, input.path);
  }
}

/** Upload an APK into R2 or local storage and return the public URL. */
export async function uploadApkFile(input: {
  buffer?: Buffer;
  path?: string;
  filename: string;
  version: string;
  forceLocal?: boolean;
}): Promise<string> {
  const sanitizedFilename = `netmanager_v${input.version}.apk`;

  try {
    if ((await isR2Enabled()) && !input.forceLocal) {
      return uploadApkToR2(input, sanitizedFilename);
    }

    return uploadApkToLocal(input, sanitizedFilename);
  } catch (error: unknown) {
    logger.error("[AppVersionService] Error uploading APK file:", error);
    const err = error as { message?: string };
    throw new Error(
      `Gagal mengunggah file APK: ${err?.message || "Terjadi kesalahan"}`,
    );
  }
}

/** Create a pre-signed URL for direct APK upload. */
export async function createDirectUploadUrl(params: {
  filename: string;
  contentType: string;
  expiresIn?: number;
}) {
  const sanitizedFilename = params.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = generateR2Key("app-version", sanitizedFilename);
  const contentDisposition = `attachment; filename="${sanitizedFilename}"`;
  const { uploadUrl, publicUrl } = await getPresignedUrl(
    key,
    params.contentType,
    params.expiresIn ?? PRESIGNED_EXPIRES_IN,
    contentDisposition,
  );

  return { uploadUrl, publicUrl, key, filename: params.filename };
}

function buildUploadedApkUrl(
  uploadedKey: string,
  settings: Awaited<ReturnType<typeof getR2Settings>>,
) {
  if (!settings) {
    return uploadedKey;
  }

  if (settings.publicUrl) {
    return `${settings.publicUrl.replace(/\/$/, "")}/${uploadedKey}`;
  }

  return `https://${settings.bucketName}.${settings.accountId}.r2.cloudflarestorage.com/${uploadedKey}`;
}

async function resolveApkTempPath(input: { buffer?: Buffer; path?: string }) {
  if (input.path) {
    return input.path;
  }

  if (!input.buffer) {
    return null;
  }

  const tempPath = path.join(os.tmpdir(), `apk_${Date.now()}.apk`);
  await fs.writeFile(tempPath, input.buffer);
  return tempPath;
}

function buildParsedApkInfo(manifest: ApkManifest): ParsedApkInfo {
  const versionName = manifest.versionName || "";
  const versionCode = manifest.versionCode || 0;
  const versionParts = versionName.split(".");
  const buildNumber =
    versionParts.length >= 3
      ? parseInt(versionParts[2] ?? "0", 10) || versionCode
      : versionCode;

  return {
    versionName,
    versionCode,
    packageName: manifest.package || "",
    buildNumber,
  };
}

function logApkParseError(error: unknown) {
  logger.error("[AppVersionService] Error parsing APK:", error);
  const err = error as { message?: string; stack?: string; code?: string };
  logger.error("[AppVersionService] Error details:", {
    message: err?.message,
    stack: err?.stack,
    code: err?.code,
  });
}

async function cleanupTempApkFile(
  tempFilePath: string | null,
  inputPath?: string,
) {
  if (!tempFilePath || inputPath) {
    return;
  }

  try {
    await fs.unlink(tempFilePath);
  } catch (error: unknown) {
    const err = error as { message?: string };
    logger.warn(
      `[AppVersionService] Failed to cleanup temp file: ${err?.message}`,
    );
  }
}

async function uploadApkToR2(
  input: { buffer?: Buffer; path?: string },
  sanitizedFilename: string,
) {
  const uploadBuffer =
    input.buffer ?? (input.path ? await fs.readFile(input.path) : undefined);
  if (!uploadBuffer) {
    throw new Error("Konten APK tidak disediakan");
  }

  const key = generateR2Key("app-version", sanitizedFilename);
  const contentDisposition = `attachment; filename="${sanitizedFilename}"`;
  return uploadToR2(uploadBuffer, key, APK_CONTENT_TYPE, contentDisposition);
}

async function uploadApkToLocal(
  input: { buffer?: Buffer; path?: string },
  sanitizedFilename: string,
) {
  const uploadDir = path.join(process.cwd(), "public", "uploads", "apk");
  await fs.mkdir(uploadDir, { recursive: true });

  const destinationPath = path.join(uploadDir, sanitizedFilename);
  if (input.path) {
    await fs.copyFile(input.path, destinationPath);
  } else if (input.buffer) {
    await fs.writeFile(destinationPath, input.buffer);
  } else {
    throw new Error("Konten APK tidak disediakan (tidak ada buffer atau path)");
  }

  return `/uploads/apk/${sanitizedFilename}`;
}
