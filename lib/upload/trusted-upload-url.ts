import type { NextRequest } from "next/server";

import { tenantJalurUpload } from "@/lib/upload/upload-policy";
import { getR2Settings } from "@/lib/utils/image-upload";

/**
 * URL berkas upload yang bisa dipercaya: berada di `/uploads/` dan disajikan
 * host aplikasi ini (host permintaan) atau penyimpanan R2 milik aplikasi.
 * URL di luar itu bisa menunjuk server siapa pun — gambar chat yang dimuat
 * dari sana membocorkan IP dan browser setiap staf yang membukanya.
 */
export async function isTrustedUploadUrl(
  url: URL,
  request: NextRequest,
): Promise<boolean> {
  if (!url.pathname.startsWith("/uploads/")) return false;

  const host = request.headers.get("host");
  const isSameHost = host ? url.host === host : false;
  const isDefaultR2Url = url.hostname.endsWith(".r2.cloudflarestorage.com");
  if (isSameHost || isDefaultR2Url) return true;

  const r2Settings = await getR2Settings();
  const publicPrefix = r2Settings?.publicUrl?.replace(/\/$/, "");
  return publicPrefix ? url.toString().startsWith(`${publicPrefix}/`) : false;
}

/**
 * Gambar chat sah bila URL-nya tepercaya dan berada di folder upload tenant
 * pengirim — bukan gambar tenant lain dan bukan gambar dari server luar.
 */
export async function isTrustedChatImageUrl(
  rawUrl: string,
  request: NextRequest,
  tenantId: string,
): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  if (tenantJalurUpload(url.pathname) !== tenantId) return false;
  return isTrustedUploadUrl(url, request);
}

/** URL absolut berkas upload: URL R2 apa adanya, jalur lokal diberi host. */
export function resolveAbsoluteUploadUrl(
  request: NextRequest,
  url: string,
): string {
  if (url.startsWith("http")) return url;
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const host = request.headers.get("host");
  return `${protocol}://${host}${url}`;
}
