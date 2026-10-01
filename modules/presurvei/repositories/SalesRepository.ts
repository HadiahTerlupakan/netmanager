import { prisma } from "@/modules/database";
import { tentukanNamaSales } from "../domain/nama-sales";
import type { CalonSales } from "../domain/penugasan-sales";
import type {
  ISalesRepository,
  SalesRingkas,
} from "../domain/ports/ISalesRepository";
import { pastikanTenantTerisi } from "./pastikan-tenant-terisi";

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
    pastikanTenantTerisi(tenantId, "Daftar sales presurvei");

    const rows = await prisma.user.findMany({
      where: { tenantId, isSales: true, isActive: true },
      select: { id: true, name: true },
    });

    return urutkanSales(rows);
  }

  /** Sales aktif satu tenant dari daftar id (dirinya + anggota tim kepala sales). */
  async daftarAktifDariIds(
    tenantId: string,
    ids: string[],
  ): Promise<SalesRingkas[]> {
    pastikanTenantTerisi(tenantId, "Daftar sales tim presurvei");
    if (ids.length === 0) return [];

    const rows = await prisma.user.findMany({
      where: { tenantId, isSales: true, isActive: true, id: { in: ids } },
      select: { id: true, name: true },
    });

    return urutkanSales(rows);
  }

  /** User aktif satu tenant yang role-nya boleh memberi rencana (kepala sales). */
  async daftarKandidatKepalaSales(tenantId: string): Promise<SalesRingkas[]> {
    pastikanTenantTerisi(tenantId, "Daftar kandidat kepala sales");

    const rows = await prisma.user.findMany({
      where: {
        tenantId,
        isActive: true,
        role: { permission: { some: IZIN_PEMBERI_RENCANA } },
      },
      select: { id: true, name: true },
    });

    return urutkanSales(rows);
  }

  /**
   * Fakta penugasan satu user — tanpa nama maupun email.
   *
   * `userId` kosong dijawab null tanpa query: `findUnique` dengan
   * `id: undefined` bukan "tidak ada", melainkan query yang tidak sah.
   */
  async cariCalonSales(userId: string): Promise<CalonSales | null> {
    if (!userId) return null;

    const row = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, tenantId: true, isSales: true, isActive: true },
    });
    if (!row) return null;

    return {
      id: row.id,
      tenantId: row.tenantId ?? null,
      isSales: row.isSales,
      isActive: row.isActive,
    };
  }
}

/** Izin yang menandai seseorang bisa memimpin tim penugasan rencana. */
const IZIN_PEMBERI_RENCANA = { resource: "presurvei_rencana", action: "create" };

/** Label tampilan + urutan stabil (nama, lalu id) untuk dropdown sales. */
function urutkanSales(
  rows: { id: string; name: string | null }[],
): SalesRingkas[] {
  return rows
    .map((row) => ({ id: row.id, nama: tentukanNamaSales(row) }))
    .sort((a, b) => a.nama.localeCompare(b.nama) || a.id.localeCompare(b.id));
}
