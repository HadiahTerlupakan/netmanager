/**
 * Kontrak akses daftar departemen untuk filter presurvei.
 *
 * Service hanya bergantung pada antarmuka ini supaya bisa diuji tanpa database.
 */

/** Satu departemen beserta nama tampilannya. */
export interface DepartemenRingkas {
  id: string;
  nama: string;
}

export interface IDepartemenRepository {
  /**
   * Departemen milik SATU tenant, terurut menurut nama.
   *
   * `tenantId` wajib dan ditulis eksplisit di query: `Departments` adalah
   * model referensi global di ekstensi tenant (`lib/prisma-extension.ts`,
   * `GLOBAL_REFERENCE_MODELS`) yang juga meloloskan baris tak bertenant, dan
   * untuk super admin ekstensi tidak menyaring sama sekali.
   */
  daftar(tenantId: string): Promise<DepartemenRingkas[]>;
}
