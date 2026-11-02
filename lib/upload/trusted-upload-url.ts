import type { NextRequest } from "next/server";

import { tenantJalurUpload } from "@/lib/upload/upload-policy";
import { getR2Settings } from "@/lib/utils/image-upload";

/**
 * Env yang memuat URL publik aplikasi. Host tepercaya diambil dari sini, bukan
 * dari header `Host` permintaan: header itu dikirim klien.
 */
const APP_URL_ENV_KEYS = [
  "NEXTAUTH_URL",
  "NEXT_PUBLIC_APP_URL",
  "APP_URL",
] as const;

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, "");
}

/** Hostname aplikasi dari konfigurasi server (mis. `radpro.id`). */
function configuredAppHostnames(): string[] {
  const hostnames = new Set<string>();
  for (const key of APP_URL_ENV_KEYS) {
    const value = process.env[key];
    if (!value) continue;
    try {
      hostnames.add(normalizeHostname(new URL(value).hostname));
    } catch {
      // URL env yang rusak dilewati; env lain masih bisa memberi host.
    }
  }
  return [...hostnames];
}

/** Host aplikasi sendiri atau subdomainnya (`admin.radpro.id`, `karyawan.radpro.id`). */
function isAppHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  return configuredAppHostnames().some(
    (appHost) => normalized === appHost || normalized.endsWith(`.${appHost}`),
  );
}

/**
 * Bucket R2 milik aplikasi: host default `{bucket}.{account}` yang persis,
 * atau URL publik yang dikonfigurasi. Sufiks `.r2.cloudflarestorage.com`
 * saja tidak cukup — itu cocok dengan bucket akun Cloudflare siapa pun.
 */
async function isOwnR2Url(url: URL): Promise<boolean> {
  const r2Settings = await getR2Settings();
  if (!r2Settings) return false;

  const { bucketName, accountId, publicUrl } = r2Settings;
  if (bucketName && accountId) {
    const defaultHost = `${bucketName}.${accountId}.r2.cloudflarestorage.com`;
    if (normalizeHostname(url.hostname) === normalizeHostname(defaultHost)) {
      return true;
    }
  }

  const publicPrefix = publicUrl?.replace(/\/$/, "");
  return publicPrefix ? url.toString().startsWith(`${publicPrefix}/`) : false;
}

/**
 * URL berkas upload yang bisa dipercaya: berada di `/uploads/` dan disajikan
 * host aplikasi ini atau bucket R2 milik aplikasi. URL di luar itu bisa
 * menunjuk server siapa pun — gambar chat yang dimuat dari sana membocorkan
 * IP dan browser setiap staf yang membukanya, dan penghapusan berkas bisa
 * diarahkan ke kunci bucket kita lewat URL bucket orang lain.
 */
export async function isTrustedUploadUrl(url: URL): Promise<boolean> {
  if (!url.pathname.startsWith("/uploads/")) return false;
  if (isAppHostname(url.hostname)) return true;
  return isOwnR2Url(url);
}

/**
 * Gambar chat sah bila URL-nya tepercaya dan berada di folder upload tenant
 * pengirim — bukan gambar tenant lain dan bukan gambar dari server luar.
 */
export async function isTrustedChatImageUrl(
  rawUrl: string,
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
  return isTrustedUploadUrl(url);
}

/**
 * URL absolut untuk dikembalikan ke pengunggah: URL R2 apa adanya, jalur
 * lokal diberi host permintaan. Ini hanya jawaban untuk klien itu sendiri,
 * bukan keputusan percaya — URL hasilnya tetap diperiksa
 * `isTrustedUploadUrl` saat dipakai.
 */
export function resolveAbsoluteUploadUrl(
  request: NextRequest,
  url: string,
): string {
  if (url.startsWith("http")) return url;
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const host = request.headers.get("host");
  return `${protocol}://${host}${url}`;
}
