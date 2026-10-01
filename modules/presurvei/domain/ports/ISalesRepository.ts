import type { CalonSales } from "../penugasan-sales";

/**
 * Kontrak akses daftar sales untuk layar presurvei.
 *
 * Service hanya bergantung pada antarmuka ini supaya bisa diuji tanpa database.
 */

/** Seorang sales beserta label tampilannya (`tentukanNamaSales`). */
export interface SalesRingkas {
  id: string;
  nama: string;
}

export interface ISalesRepository {
  /**
   * Sales aktif di SATU tenant, terurut menurut nama.
   *
   * `tenantId` wajib dan ditulis eksplisit di query, bukan diserahkan ke
   * ekstensi tenant: pada konteks super admin ekstensi itu tidak menyaring
   * apa pun (`lib/prisma-extension.ts`, `isNonSuperAdminTenant`).
   */
  daftarAktif(tenantId: string): Promise<SalesRingkas[]>;

  /** Sales aktif di SATU tenant yang id-nya ada di `ids` (tim kepala sales). */
  daftarAktifDariIds(tenantId: string, ids: string[]): Promise<SalesRingkas[]>;

  /**
   * User aktif satu tenant yang role-nya memegang `presurvei_rencana:create`
   * — kandidat kepala sales di form user. Tidak mensyaratkan `isSales`.
   */
  daftarKandidatKepalaSales(tenantId: string): Promise<SalesRingkas[]>;

  /**
   * Fakta penugasan satu user, null bila tidak ada.
   *
   * Sengaja TIDAK menyaring `isSales`/`isActive`/tenant di query: keputusan
   * itu milik `isCalonSalesSah` supaya hanya ada satu definisinya.
   */
  cariCalonSales(userId: string): Promise<CalonSales | null>;
}
