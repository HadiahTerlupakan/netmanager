import { prisma } from "@/modules/database";
import type {
  DepartemenRingkas,
  IDepartemenRepository,
} from "../domain/ports/IDepartemenRepository";
import { pastikanTenantTerisi } from "./pastikan-tenant-terisi";

/**
 * Akses daftar departemen untuk filter layar presurvei.
 *
 * Membaca tabel departemen langsung, bukan lewat `modules/roles`: layanan
 * departemen di sana tidak memberi cara menulis tenant eksplisit, dan layar
 * presurvei tidak boleh menuntut izin `department:read`. Pola dan penjaganya
 * sama dengan `SalesRepository`.
 */
export class DepartemenRepository implements IDepartemenRepository {
  /** Departemen satu tenant, terurut menurut nama. */
  async daftar(tenantId: string): Promise<DepartemenRingkas[]> {
    // Fail-closed. Dengan `strictNullChecks: false` compiler meloloskan
    // `undefined` ke sini, dan Prisma memperlakukan `tenantId: undefined`
    // sebagai "tanpa syarat" — departemen SEMUA tenant.
    pastikanTenantTerisi(tenantId, "Daftar departemen presurvei");

    const rows = await prisma.departments.findMany({
      where: { tenantId },
      select: { id: true, name: true },
    });

    return rows
      .map((row) => ({ id: row.id, nama: row.name }))
      .sort((a, b) => a.nama.localeCompare(b.nama) || a.id.localeCompare(b.id));
  }
}
