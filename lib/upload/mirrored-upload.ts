import { mkdir, rm, stat, writeFile } from "fs/promises";
import path from "path";

import { logger } from "@/lib/logger";
import { isR2KeyPublic } from "@/lib/upload/upload-policy";
import { hapusTertunda, tandaiTertunda } from "@/lib/upload/upload-sync-queue";
import { uploadToR2 } from "@/lib/utils/r2-client";

/**
 * Lokasi salinan lokal sebuah kunci R2, atau null bila kunci itu keluar dari
 * volume uploads. Kunci R2 sama dengan jalur URL-nya (`uploads/…`), jadi
 * salinan di `public/<kunci>` langsung disajikan `server.ts` lewat URL yang
 * sama.
 */
export function jalurSalinanLokal(key: string): string | null {
  const uploadsRoot = path.resolve(
    /*turbopackIgnore: true*/ process.cwd(),
    "public",
    "uploads",
  );
  const target = path.resolve(
    /*turbopackIgnore: true*/ process.cwd(),
    "public",
    key,
  );
  return target.startsWith(uploadsRoot + path.sep) ? target : null;
}

async function simpanSalinanLokal(
  buffer: Buffer,
  key: string,
): Promise<boolean> {
  const target = jalurSalinanLokal(key);
  if (!target) {
    logger.warn(
      "[Upload] Kunci di luar volume uploads, salinan lokal dilewati",
      {
        key,
      },
    );
    return false;
  }
  try {
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, buffer);
    return true;
  } catch (error) {
    logger.warn("[Upload] Gagal menyimpan salinan lokal", { key, error });
    return false;
  }
}

/**
 * URL yang dipakai klien untuk sebuah objek R2.
 *
 * Bucket R2 disajikan lewat URL publik tanpa autentikasi apa pun, jadi
 * mengembalikan URL itu untuk berkas pribadi berarti KTP pelanggan bisa dibuka
 * siapa saja yang tahu alamatnya — tanpa login, apalagi tanpa pemeriksaan
 * tenant. Berkas pribadi karena itu dirujuk lewat jalur `/uploads/...` milik
 * aplikasi sendiri, yang sudah menegakkan sesi dan tenant lalu mengalirkan
 * isinya dari R2.
 */
function urlObjekR2(key: string, urlPublik: string): string {
  return isR2KeyPublic(key) ? urlPublik : `/${key}`;
}

/**
 * Simpan berkas ke R2 sekaligus ke volume `public/uploads` yang permanen.
 *
 * Dulu berkas hanya ada di R2: R2 yang gangguan menggagalkan upload, dan isi
 * bucket yang hilang tidak punya cadangan. Saat R2 gagal, berkas dirujuk lewat
 * jalur `/uploads/…` yang disajikan dari salinan lokal, lalu dicatat agar cron
 * `upload-sync` mengunggahnya ke R2 belakangan.
 */
export async function simpanBerkasUpload(
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<string> {
  const tersimpanLokal = await simpanSalinanLokal(buffer, key);

  try {
    const url = await uploadToR2(buffer, key, contentType);
    logger.info("File uploaded to R2:", { key, url });
    return urlObjekR2(key, url);
  } catch (error) {
    if (!tersimpanLokal) throw error;

    logger.warn("[Upload] R2 gagal, berkas disajikan dari salinan lokal", {
      key,
      error,
    });
    try {
      await tandaiTertunda(key, contentType);
    } catch (queueError) {
      logger.error("[Upload] Gagal mencatat berkas untuk sinkron R2", {
        key,
        queueError,
      });
    }
    return `/${key}`;
  }
}

/**
 * Hapus salinan lokal sebuah kunci beserta antrean sinkronnya. `server.ts`
 * membaca salinan lokal lebih dulu, dan cron upload-sync mengunggah ulang yang
 * masih di antrean: tanpa keduanya berkas yang dihapus tetap tersaji atau
 * kembali ke R2. True bila salinan lokalnya memang ada.
 */
export async function hapusSalinanLokal(key: string): Promise<boolean> {
  const target = jalurSalinanLokal(key);
  if (!target) return false;

  const ada = await stat(target).then(
    (info) => info.isFile(),
    () => false,
  );
  await rm(target, { force: true });
  try {
    await hapusTertunda(key);
  } catch (error) {
    // Tanpa salinan lokal, cron upload-sync membuang baris ini sendiri.
    logger.warn("[Upload] Gagal menghapus antrean sinkron", { key, error });
  }
  return ada;
}
