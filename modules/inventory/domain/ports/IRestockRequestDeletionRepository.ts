import type { RestockStatusInput } from "../restock-request-status";

/**
 * Pengajuan yang akan dihapus, dalam read-model yang sama dengan yang dipakai
 * layar untuk menampilkan tombol Hapus, supaya server dan layar memakai aturan
 * yang sama.
 */
export interface RestockRequestForDeletion extends RestockStatusInput {
  id: string;
  nomorRequest: string;
}

/** Akses data untuk menghapus pengajuan restock. */
export interface IRestockRequestDeletionRepository {
  /** Pengajuan milik tenant beserta baris, jasa, dan pesanannya; null bila tidak ada. */
  findPurchaseRequestDetail(
    id: string,
    tenantId: string,
  ): Promise<RestockRequestForDeletion | null>;

  /**
   * Hapus pengajuan beserta barisnya hanya bila database masih menyatakannya
   * boleh dihapus: tanpa pesanan (pesanan DRAFT-nya sudah dihapus lebih
   * dulu), belum Sudah Sampai, dan tanpa jasa yang sudah ditandai
   * selesai. False bila ada yang berubah sejak dibaca, misalnya pesanan baru
   * saja dibuat untuknya.
   */
  deletePurchaseRequestIfDeletable(
    id: string,
    tenantId: string,
  ): Promise<boolean>;
}
