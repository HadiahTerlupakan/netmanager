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
}
