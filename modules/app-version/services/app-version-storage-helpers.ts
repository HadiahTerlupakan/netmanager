import fs from "fs/promises";
import path from "path";

import { getR2Settings } from "@/lib/utils/r2-client";

const DIRECT_UPLOAD_PREFIX = "uploads/apk/";

/** Check whether the APK URL points to local public storage. */
export function isLocalApkUrl(apkUrl: string) {
  return apkUrl.startsWith("/uploads/apk/") || apkUrl.startsWith("/apk/");
}

/** Delete a locally stored APK file from the public uploads directory. */
export async function deleteLocalApk(apkUrl: string) {
  const relativePath = apkUrl.replace(/^\//, "");
  const localPath = path.join(process.cwd(), "public", relativePath);
  await fs.unlink(localPath);
}

/** Extract the R2 object key from a public APK URL when available. */
export function extractUploadedKeyFromUrl(apkUrl: string) {
  if (!/^https?:\/\//.test(apkUrl) || !apkUrl.includes(DIRECT_UPLOAD_PREFIX)) {
    return null;
  }

  const keyIndex = apkUrl.indexOf(DIRECT_UPLOAD_PREFIX);
  return keyIndex === -1 ? null : apkUrl.substring(keyIndex);
}

/** Build the public URL for an uploaded direct-upload APK object. */
export function buildUploadedApkUrl(
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
