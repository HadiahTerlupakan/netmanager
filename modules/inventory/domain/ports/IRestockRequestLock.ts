/** Melepas kunci pengajuan setelah pekerjaannya selesai. */
export type RestockRequestLockRelease = () => Promise<void>;

/**
 * Kunci per pengajuan restock: Masukkan Barang, Batalkan, dan Hapus pada
 * pengajuan yang sama tidak boleh berjalan bersamaan.
 */
export interface IRestockRequestLock {
  /** Ambil kunci pengajuan; null bila sedang dipegang permintaan lain. */
  acquire(purchaseRequestId: string): Promise<RestockRequestLockRelease | null>;
}
