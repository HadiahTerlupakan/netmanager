import sharp from "sharp";
import { ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** Toleransi warna saat menentukan piksel bingkai; 10 aman untuk PNG anti-alias. */
const TRIM_THRESHOLD = 10;

/** Hasil pangkas di bawah ukuran ini dianggap gagal, bukan logo. */
const MIN_TRIMMED_DIMENSION_PX = 8;

const MAX_LOGO_SIDE_PX = 4096;
// Batas decode sebelum dimensi diperiksa: file 5 MB bisa berisi gambar
// raksasa yang menghabiskan memori saat di-decode.
const SHARP_LIMITS = { limitInputPixels: MAX_LOGO_SIDE_PX * MAX_LOGO_SIDE_PX };

// Format bitmap saja; SVG bisa berisi skrip dan tidak diterima.
const LOGO_FORMATS: Record<string, { extension: string; mime: string }> = {
  png: { extension: ".png", mime: "image/png" },
  jpeg: { extension: ".jpg", mime: "image/jpeg" },
  webp: { extension: ".webp", mime: "image/webp" },
  gif: { extension: ".gif", mime: "image/gif" },
};
const INVALID_LOGO_MESSAGE = "File harus berupa gambar (PNG, JPG, WebP, GIF)";

/**
 * Buang bingkai kosong di sekeliling gambar.
 *
 * Why: banyak berkas logo diekspor dengan kanvas jauh lebih besar dari
 * gambarnya. Karena tata letak invoice mengepaskan seluruh kanvas, bingkai
 * kosong itu ikut diperhitungkan dan logo tampil kecil — misalnya kanvas
 * 1536x1024 yang tintanya hanya 897x194 (11% area) tercetak sekitar 67x14px.
 *
 * Mengembalikan `null` bila gambar tidak bisa diproses, supaya pemanggil bisa
 * jatuh kembali ke berkas asli alih-alih gagal.
 */
export async function trimImagePadding(
  buffer: Buffer,
): Promise<{ data: Buffer; width: number; height: number } | null> {
  try {
    const { data, info } = await sharp(buffer)
      .trim({ threshold: TRIM_THRESHOLD })
      .toBuffer({ resolveWithObject: true });

    if (
      info.width < MIN_TRIMMED_DIMENSION_PX ||
      info.height < MIN_TRIMMED_DIMENSION_PX
    ) {
      return null;
    }

    return { data, width: info.width, height: info.height };
  } catch (error) {
    logger.warn("[Logo] Gagal memangkas bingkai kosong:", error);
    return null;
  }
}

async function readLogoFormat(buffer: Buffer) {
  try {
    return await sharp(buffer, SHARP_LIMITS).metadata();
  } catch {
    throw new ValidationError(INVALID_LOGO_MESSAGE);
  }
}

/**
 * Siapkan berkas unggahan logo: format dibaca dari isi berkas dan gambar
 * di-encode ulang, lalu ekstensi dan tipe diambil dari format itu.
 *
 * Why: nama dan tipe berkas dari klien tidak dipercaya. Berkas HTML atau SVG
 * yang disimpan dengan ekstensinya sendiri disajikan sebagai halaman di origin
 * aplikasi dan menjalankan skripnya (stored XSS).
 */
export async function toSafeLogoFile(
  file: File,
): Promise<{ file: File; extension: string }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const { format, width = 0, height = 0 } = await readLogoFormat(buffer);
  const target = format ? LOGO_FORMATS[format] : undefined;
  if (!target) {
    throw new ValidationError(INVALID_LOGO_MESSAGE);
  }
  if (width > MAX_LOGO_SIDE_PX || height > MAX_LOGO_SIDE_PX) {
    throw new ValidationError(`Dimensi logo maksimal ${MAX_LOGO_SIDE_PX}px`);
  }

  const trimmed = await trimImagePadding(buffer);
  const data = trimmed?.data ?? (await sharp(buffer, SHARP_LIMITS).toBuffer());

  return {
    file: new File([new Uint8Array(data)], `logo${target.extension}`, {
      type: target.mime,
    }),
    extension: target.extension,
  };
}
