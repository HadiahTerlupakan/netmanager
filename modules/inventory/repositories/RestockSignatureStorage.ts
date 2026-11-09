import { randomUUID } from "crypto";

import { logger } from "@/lib/logger";
import {
  deleteFromR2,
  downloadFromR2,
  isR2Enabled,
  uploadToR2,
} from "@/lib/utils/r2-client";

import {
  buildSignatureKeyPrefix,
  RESTOCK_SIGNATURE_ROOT_PREFIX,
  type IRestockSignatureStorage,
} from "../domain/ports/IRestockSignatureStorage";

const SIGNATURE_CONTENT_TYPE = "image/png";

/**
 * Tanda tangan pembeli di R2. Sengaja tanpa jalur cadangan ke disk lokal
 * (aplikasi berjalan beberapa replika; berkas di disk satu pod tidak terlihat
 * pod lain). Kunci tidak pernah dibagikan sebagai URL publik; gambar hanya
 * mengalir lewat route ber-auth.
 */
export class RestockSignatureStorage implements IRestockSignatureStorage {
  /** True bila R2 aktif. */
  isAvailable(): Promise<boolean> {
    return isR2Enabled();
  }

  /** Simpan PNG dengan nama acak di awalan tenant/pengajuan. */
  async save(input: {
    tenantId: string;
    purchaseRequestId: string;
    buffer: Buffer;
  }): Promise<string> {
    const key = `${buildSignatureKeyPrefix(input.tenantId, input.purchaseRequestId)}ttd-${randomUUID()}.png`;
    await uploadToR2(input.buffer, key, SIGNATURE_CONTENT_TYPE);
    return key;
  }

  /** Isi berkas; kunci di luar awalan belanja ditolak. */
  async read(key: string): Promise<Buffer | null> {
    if (!key.startsWith(RESTOCK_SIGNATURE_ROOT_PREFIX)) return null;
    return downloadFromR2(key);
  }

  /** Hapus berkas; kegagalan hanya dicatat. */
  async remove(key: string): Promise<void> {
    try {
      await deleteFromR2(key);
    } catch (error) {
      logger.warn("[RESTOCK_SIGNATURE] Gagal menghapus tanda tangan", {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
