import path from "path";
import { readFile } from "fs/promises";
import { cache } from "@/lib/cache";
import { logger } from "@/lib/logger";
import { getLogoSettings, type LogoType } from "./logoSettings";
import { trimImagePadding } from "./logo-trim";

const CACHE_TTL_SECONDS = 3600;
const CACHE_KEY_PREFIX = "logo-trimmed";
const FETCH_TIMEOUT_MS = 10_000;
const DEFAULT_CONTENT_TYPE = "image/png";

export interface TrimmedLogo {
  data: Buffer;
  contentType: string;
  /** Ditandai dari sumber + ukuran hasil, jadi logo baru membatalkan cache. */
  etag: string;
}

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

function resolveContentType(sourceUrl: string): string {
  const extension = path.extname(new URL(sourceUrl, "http://x").pathname);
  return (
    CONTENT_TYPE_BY_EXTENSION[extension.toLowerCase()] ?? DEFAULT_CONTENT_TYPE
  );
}

function selectLogoUrl(
  settings: Awaited<ReturnType<typeof getLogoSettings>>,
  type: LogoType,
): string | null {
  const urlByType: Record<LogoType, string | null> = {
    invoice: settings.logoInvoice,
    aplikasi: settings.logoAplikasi,
    landing: settings.logoLandingPage,
  };
  return urlByType[type];
}

async function readSourceBytes(sourceUrl: string): Promise<Buffer | null> {
  if (/^https?:\/\//i.test(sourceUrl)) {
    const response = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  }

  const localPath = path.join(
    process.cwd(),
    "public",
    sourceUrl.replace(/^\/+/, ""),
  );
  return readFile(localPath);
}

/**
 * Ambil logo tersimpan lalu buang bingkai kosongnya.
 *
 * Why di sisi tampil, bukan hanya saat unggah: berkas yang sudah terlanjur
 * tersimpan dengan padding tidak ikut terpangkas oleh jalur unggah, dan
 * memaksa setiap tenant mengunggah ulang bukan solusi. Di sini berkas sumber
 * tidak diubah sama sekali — hasil pangkas disimpan di cache proses.
 *
 * Mengembalikan `null` bila logo belum diatur atau sumbernya tidak terbaca,
 * supaya pemanggil bisa jatuh kembali ke berkas asli.
 */
export async function getTrimmedLogo(
  type: LogoType,
): Promise<TrimmedLogo | null> {
  const settings = await getLogoSettings();
  const sourceUrl = selectLogoUrl(settings, type);
  if (!sourceUrl) return null;

  const cacheKey = `${CACHE_KEY_PREFIX}:${sourceUrl}`;
  const cached = cache.get<TrimmedLogo>(cacheKey);
  if (cached) return cached;

  try {
    const sourceBytes = await readSourceBytes(sourceUrl);
    if (!sourceBytes) return null;

    const trimmed = await trimImagePadding(sourceBytes);
    if (!trimmed) return null;

    const result: TrimmedLogo = {
      data: trimmed.data,
      contentType: resolveContentType(sourceUrl),
      etag: `"${Buffer.from(sourceUrl).toString("base64url").slice(0, 24)}-${trimmed.data.length}"`,
    };

    cache.set(cacheKey, result, CACHE_TTL_SECONDS);
    return result;
  } catch (error) {
    logger.warn("[Logo] Gagal menyiapkan logo terpangkas:", error);
    return null;
  }
}
