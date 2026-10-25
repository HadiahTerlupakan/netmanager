import path from "path";
import { readFile } from "fs/promises";
import sharp from "sharp";
import { logger } from "@/lib/logger";
import { getR2PublicBaseUrl } from "@/lib/utils/r2-client";

const LOGO_MAX_SIDE_PX = 160;
const LOGO_WEBP_QUALITY = 70;
const LOGO_FETCH_TIMEOUT_MS = 5_000;
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
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

/** Hanya URL di bawah basis publik R2 aplikasi sendiri yang dianggap aman. */
async function isOwnStorageUrl(url: string): Promise<boolean> {
  const base = await getR2PublicBaseUrl();
  if (!base) {
    return false;
  }
  try {
    const target = new URL(url);
    const root = new URL(base);
    const rootPath = root.pathname.replace(/\/+$/, "");
    return (
      target.origin === root.origin &&
      (target.pathname === rootPath ||
        target.pathname.startsWith(`${rootPath}/`))
    );
  } catch {
    return false;
  }
}

async function readBodyWithinCap(response: Response): Promise<Buffer | null> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > LOGO_MAX_BYTES || !response.body) {
    return null;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      return Buffer.concat(chunks);
    }
    total += value.byteLength;
    if (total > LOGO_MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
}

// logoUrl diisi tenant, jadi hanya penyimpanan kita sendiri yang diunduh;
// URL lain bisa mengarah ke jaringan internal (SSRF).
async function readRemoteLogo(url: string): Promise<Buffer | null> {
  if (!(await isOwnStorageUrl(url))) {
    return null;
  }
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(LOGO_FETCH_TIMEOUT_MS),
  });
  return response.ok ? readBodyWithinCap(response) : null;
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
