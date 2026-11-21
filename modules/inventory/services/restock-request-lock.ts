import type { IRestockRequestLock } from "../domain/ports/IRestockRequestLock";

/** Pesan bila pengajuan sedang diproses permintaan lain. */
export const RESTOCK_REQUEST_BUSY_MESSAGE =
  "Pengajuan ini sedang diproses. Coba lagi sebentar.";

/** Penolakan karena kunci pengajuan sedang dipegang permintaan lain. */
export interface RestockRequestBusy {
  success: false;
  code: "CONFLICT";
  error: string;
}

/**
 * Jalankan `task` di bawah kunci pengajuan, supaya Masukkan Barang,
 * Batalkan, dan Hapus pada pengajuan yang sama tidak berjalan bersamaan.
 * Tanpa kunci (dipegang permintaan lain atau Redis tidak tersedia) `task`
 * tidak dijalankan. Kunci selalu dilepas, termasuk saat `task` gagal.
 */
export async function withRestockRequestLock<T>(
  lock: IRestockRequestLock,
  purchaseRequestId: string,
  task: () => Promise<T>,
): Promise<T | RestockRequestBusy> {
  const release = await lock.acquire(purchaseRequestId);
  if (!release) {
    return {
      success: false,
      code: "CONFLICT",
      error: RESTOCK_REQUEST_BUSY_MESSAGE,
    };
  }
  try {
    return await task();
  } finally {
    await release();
  }
}
