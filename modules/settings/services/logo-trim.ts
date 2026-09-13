import sharp from "sharp";
import { logger } from "@/lib/logger";

/** Toleransi warna saat menentukan piksel bingkai; 10 aman untuk PNG anti-alias. */
const TRIM_THRESHOLD = 10;

/** Hasil pangkas di bawah ukuran ini dianggap gagal, bukan logo. */
const MIN_TRIMMED_DIMENSION_PX = 8;

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

/**
 * Versi berkas dari {@link trimImagePadding} untuk jalur unggah.
 * Kegagalan pemangkasan tidak boleh membatalkan unggahan.
 */
export async function trimLogoPadding(file: File): Promise<File> {
  const originalBuffer = Buffer.from(await file.arrayBuffer());
  const trimmed = await trimImagePadding(originalBuffer);
  if (!trimmed) return file;

  return new File([new Uint8Array(trimmed.data)], file.name, {
    type: file.type,
    lastModified: file.lastModified,
  });
}
