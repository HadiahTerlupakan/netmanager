/**
 * Kontrak akses struktur tim sales (kepala sales → anggota).
 *
 * Service hanya bergantung pada antarmuka ini supaya bisa diuji tanpa database.
 */

/** Seorang anggota aktif beserta kepala sales-nya. */
export interface AnggotaTim {
  id: string;
  nama: string;
  kepalaSalesId: string;
}

/** Identitas ringkas seorang pengguna. */
export interface IdentitasPengguna {
  id: string;
  nama: string;
}

export interface ITimSalesRepository {
  /** Semua anggota aktif yang punya kepala sales, di SATU tenant. */
  daftarAnggotaTim(tenantId: string): Promise<AnggotaTim[]>;

  /** Nama tampilan pengguna-pengguna ini (tenant yang sama). */
  identitas(tenantId: string, ids: string[]): Promise<IdentitasPengguna[]>;
}
