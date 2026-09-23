import { prisma } from "@/modules/database";
import { TenantContextError } from "@/lib/prisma-extension";
import { tentukanNamaSales } from "../domain/nama-sales";
import type {
  ISalesRepository,
  SalesRingkas,
} from "../domain/ports/ISalesRepository";

/**
 * Akses daftar sales presurvei.
 *
 * Definisi "sales" sama persis dengan penugasan prospek otomatis
 * (`services/event-handlers/cari-sales-teringan.ts:22`): `isSales` dan
 * `isActive` dalam satu tenant. Dua definisi yang berbeda akan membuat
 * dropdown menawarkan orang yang tidak pernah menerima prospek, atau
 * sebaliknya.
 */
export class SalesRepository implements ISalesRepository {
  /** Sales aktif satu tenant, terurut menurut label tampilannya. */
  async daftarAktif(tenantId: string): Promise<SalesRingkas[]> {
    // Fail-closed. Dengan `strictNullChecks: false` compiler meloloskan
    // `undefined` ke sini, dan Prisma memperlakukan `tenantId: undefined`
    // sebagai "tanpa syarat" — daftar sales SEMUA tenant.
    if (!tenantId) {
      throw new TenantContextError(
        "missing-context",
        "Daftar sales presurvei diminta tanpa tenantId",
      );
    }

    const rows = await prisma.user.findMany({
      where: { tenantId, isSales: true, isActive: true },
      select: { id: true, name: true, email: true },
    });

    return rows
      .map((row) => ({ id: row.id, nama: tentukanNamaSales(row) }))
      .sort((a, b) => a.nama.localeCompare(b.nama) || a.id.localeCompare(b.id));
  }
}
