import { prisma } from "@/modules/database";
import { tentukanNamaSales } from "../domain/nama-sales";
import type {
  AnggotaTim,
  IdentitasPengguna,
  ITimSalesRepository,
} from "../domain/ports/ITimSalesRepository";
import { pastikanTenantTerisi } from "./pastikan-tenant-terisi";

/**
 * Akses struktur tim sales (`User.kepalaSalesId`).
 *
 * `tenantId` ditulis eksplisit (fail-closed), pola sama dengan `SalesRepository`.
 */
export class TimSalesRepository implements ITimSalesRepository {
  async daftarAnggotaTim(tenantId: string): Promise<AnggotaTim[]> {
    pastikanTenantTerisi(tenantId, "Daftar anggota tim sales");
    const rows = await prisma.user.findMany({
      where: { tenantId, isActive: true, kepalaSalesId: { not: null } },
      select: { id: true, name: true, kepalaSalesId: true },
    });
    return rows.map((row) => ({
      id: row.id,
      nama: tentukanNamaSales(row),
      kepalaSalesId: row.kepalaSalesId as string,
    }));
  }

  async identitas(tenantId: string, ids: string[]): Promise<IdentitasPengguna[]> {
    pastikanTenantTerisi(tenantId, "Identitas pengguna presurvei");
    if (ids.length === 0) return [];
    const rows = await prisma.user.findMany({
      where: { tenantId, id: { in: ids } },
      select: { id: true, name: true },
    });
    return rows.map((row) => ({ id: row.id, nama: tentukanNamaSales(row) }));
  }
}
