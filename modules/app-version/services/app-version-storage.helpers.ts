import { randomUUID } from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";

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

import type { UploadVersionInput } from "./AppVersionService.types";

const DIRECT_UPLOAD_PREFIX = "uploads/apk/";
const APK_CONTENT_TYPE = "application/vnd.android.package-archive";
const PRESIGNED_EXPIRES_IN = 3600;
const LOCAL_APK_DIRECTORY = ["public", "uploads", "apk"] as const;

export interface UploadedApkDetails {
  apkBuffer?: Buffer;
  apkSize?: number;
  apkUrl?: string;
}

/** Validate direct-upload key sebelum membaca object upload. */
export function validateUploadedKey(key: string): void {
  if (!key.startsWith(DIRECT_UPLOAD_PREFIX)) {
    throw new Error("Lokasi file direct upload tidak valid");
  }
}

/** Hapus object APK yang sebelumnya tersimpan di storage. */
export async function deleteUploadedApkObject(key: string): Promise<void> {
  await deleteR2Object(key);
}

/** Hapus APK tersimpan baik dari disk lokal maupun R2. */
export async function cleanupStoredApk(apkUrl?: string | null): Promise<void> {
  if (!apkUrl) {
    return;
  }

  if (isLocalApkUrl(apkUrl)) {
    await deleteLocalApk(apkUrl);
    return;
  }

  const uploadedKey = extractUploadedKeyFromUrl(apkUrl);
  if (uploadedKey) {
    await deleteR2Object(uploadedKey);
  }
}

/** Muat detail direct-upload APK dari R2. */
export async function loadUploadedApkDetails(
  input: UploadVersionInput,
): Promise<UploadedApkDetails> {
  if (!input.uploadedKey) {
    return {};
  }

  validateUploadedKey(input.uploadedKey);
  const metadata = await getR2ObjectMetadata(input.uploadedKey);
  assertUploadedSizeMatches(input.uploadedSize, metadata.contentLength);

  const settings = await getR2Settings();
  return {
    apkBuffer: await getR2ObjectBuffer(input.uploadedKey),
    apkSize: metadata.contentLength ?? input.uploadedSize,
    apkUrl: buildUploadedApkUrl(input.uploadedKey, settings),
  };
}

/** Simpan file APK ke temp path untuk proses parsing. */
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

/** Upload APK ke R2 atau storage lokal dan return URL publik. */
export async function uploadApkFile(input: {
  buffer?: Buffer;
  path?: string;
  filename: string;
  version: string;
  forceLocal?: boolean;
}): Promise<string> {
  const sanitizedFilename = `netmanager_v${input.version}.apk`;
  const uploader = await resolveApkUploader(input.forceLocal);
  return uploader(input, sanitizedFilename);
}

/** Buat pre-signed URL untuk direct upload APK. */
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

function assertUploadedSizeMatches(
  uploadedSize?: number,
  contentLength?: number | null,
): void {
  if (
    !uploadedSize ||
    contentLength === null ||
    uploadedSize === contentLength
  ) {
    return;
  }

  throw new Error("Ukuran file APK yang diupload tidak sesuai");
}

function isLocalApkUrl(apkUrl: string): boolean {
  return apkUrl.startsWith("/uploads/apk/") || apkUrl.startsWith("/apk/");
}

async function deleteLocalApk(apkUrl: string): Promise<void> {
  const relativePath = apkUrl.replace(/^\//, "");
  const localPath = path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    "public",
    relativePath,
  );
  await fs.unlink(localPath);
}

function extractUploadedKeyFromUrl(apkUrl: string): string | null {
  if (!/^https?:\/\//.test(apkUrl) || !apkUrl.includes(DIRECT_UPLOAD_PREFIX)) {
    return null;
  }

  const keyIndex = apkUrl.indexOf(DIRECT_UPLOAD_PREFIX);
  return keyIndex === -1 ? null : apkUrl.substring(keyIndex);
}

function buildUploadedApkUrl(
  uploadedKey: string,
  settings: Awaited<ReturnType<typeof getR2Settings>>,
): string {
  if (!settings) {
    return uploadedKey;
  }

  if (settings.publicUrl) {
    return `${settings.publicUrl.replace(/\/$/, "")}/${uploadedKey}`;
  }

  return `https://${settings.bucketName}.${settings.accountId}.r2.cloudflarestorage.com/${uploadedKey}`;
}

async function resolveApkUploader(forceLocal?: boolean) {
  if ((await isR2Enabled()) && !forceLocal) {
    return uploadApkToR2;
  }

  return uploadApkToLocal;
}

async function uploadApkToR2(
  input: { buffer?: Buffer; path?: string },
  sanitizedFilename: string,
): Promise<string> {
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
): Promise<string> {
  const uploadDir = path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    ...LOCAL_APK_DIRECTORY,
  );
  await fs.mkdir(uploadDir, { recursive: true });

  const destinationPath = path.join(uploadDir, sanitizedFilename);
  if (input.path) {
    await fs.copyFile(input.path, destinationPath);
    return `/uploads/apk/${sanitizedFilename}`;
  }

  if (input.buffer) {
    await fs.writeFile(destinationPath, input.buffer);
    return `/uploads/apk/${sanitizedFilename}`;
  }

  throw new Error("Konten APK tidak disediakan");
}
