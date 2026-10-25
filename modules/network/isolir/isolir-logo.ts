import path from "path";
import { readFile } from "fs/promises";
import sharp from "sharp";
import { logger } from "@/lib/logger";

const LOGO_MAX_SIDE_PX = 160;
const LOGO_WEBP_QUALITY = 70;
const LOGO_FETCH_TIMEOUT_MS = 5_000;
const PUBLIC_DIRECTORY = "public";

async function readLocalLogo(source: string): Promise<Buffer | null> {
  const publicRoot = path.join(process.cwd(), PUBLIC_DIRECTORY);
  const filePath = path.join(publicRoot, source.replace(/^\/+/, ""));
  // Path berasal dari isian tenant; jangan biarkan ".." keluar dari public/.
  if (!filePath.startsWith(publicRoot + path.sep)) {
    return null;
  }
  return readFile(filePath);
}

async function readRemoteLogo(url: string): Promise<Buffer | null> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(LOGO_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    return null;
  }
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Mengecilkan logo menjadi data URI webp kecil, karena halaman di router
 * tidak boleh memuat aset luar. Gagal apa pun menghasilkan null.
 */
export async function buildLogoDataUri(
  source: string | null,
): Promise<string | null> {
  if (!source) {
    return null;
  }

  try {
    const original = /^https?:\/\//i.test(source)
      ? await readRemoteLogo(source)
      : await readLocalLogo(source);
    if (!original) {
      return null;
    }

    const webp = await sharp(original)
      .resize({
        width: LOGO_MAX_SIDE_PX,
        height: LOGO_MAX_SIDE_PX,
        fit: "inside",
      })
      .webp({ quality: LOGO_WEBP_QUALITY })
      .toBuffer();
    return `data:image/webp;base64,${webp.toString("base64")}`;
  } catch (error) {
    logger.warn("[isolir] Logo tidak bisa dipakai:", error);
    return null;
  }
}
