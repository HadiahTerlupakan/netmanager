import { readFile } from "fs/promises";

import { logger } from "@/lib/logger";
import { jalurSalinanLokal } from "@/lib/upload/mirrored-upload";
import {
  ambilTertunda,
  catatGagalSinkron,
  hapusTertunda,
} from "@/lib/upload/upload-sync-queue";
import { uploadToR2 } from "@/lib/utils/r2-client";

export interface HasilSinkronUpload {
  tersinkron: number;
  gagal: number;
  hilang: number;
}

async function bacaSalinanLokal(key: string): Promise<Buffer | null> {
  const target = jalurSalinanLokal(key);
  if (!target) return null;
  try {
    return await readFile(target);
  } catch {
    return null;
  }
}

/**
 * Unggah ke R2 berkas yang tersimpan hanya di volume lokal karena R2 sedang
 * gangguan saat upload. URL yang sudah tersimpan di data tetap jalur
 * `/uploads/…`, yang disajikan dari lokal lalu R2, jadi tidak perlu diubah.
 */
export async function sinkronkanUploadTertunda(
  batas: number,
): Promise<HasilSinkronUpload> {
  const hasil: HasilSinkronUpload = { tersinkron: 0, gagal: 0, hilang: 0 };

  for (const { key, contentType } of await ambilTertunda(batas)) {
    const isi = await bacaSalinanLokal(key);
    if (!isi) {
      logger.warn(
        "[UploadSync] Salinan lokal tidak ada, dikeluarkan dari antrean",
        {
          key,
        },
      );
      await hapusTertunda(key);
      hasil.hilang++;
      continue;
    }

    try {
      await uploadToR2(isi, key, contentType);
      await hapusTertunda(key);
      hasil.tersinkron++;
    } catch (error) {
      await catatGagalSinkron(
        key,
        error instanceof Error ? error.message : String(error),
      );
      hasil.gagal++;
    }
  }

  return hasil;
}
