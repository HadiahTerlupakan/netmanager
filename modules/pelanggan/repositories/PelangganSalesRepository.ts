import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/modules/database";

const PILIH_PELANGGAN_TUNGGAKAN = {
  id: true,
  idPelanggan: true,
  nama: true,
  username: true,
  alamat: true,
  noTelp: true,
  jatuhTempo: true,
  latitude: true,
  longitude: true,
  siteId: true,
  site: { select: { name: true } },
  hargaPaket: { select: { name: true } },
  salesId: true,
  sales: { select: { id: true, name: true } },
} satisfies Prisma.PelangganSelect;

export type BarisPelangganTunggakan = Prisma.PelangganGetPayload<{ select: typeof PILIH_PELANGGAN_TUNGGAKAN }>;

/** Saringan sales pada daftar tunggakan; `null` = seluruh tenant. */
export type SaringanSales = { salesIds: string[] } | null;

/**
 * Data sales penanggung jawab pelanggan (`Pelanggan.salesId`). Semua query
 * menyaring `tenantId` eksplisit (fail-closed), tidak bergantung ekstensi tenant.
 */
export class PelangganSalesRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  /** Sales aktif tenant untuk pilihan penanggung jawab, urut nama. */
  async daftarSalesAktif(tenantId: string) {
    return this.client.user.findMany({
      where: { tenantId, isSales: true, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  /** Sales aktif tenant dengan id itu, atau null. */
  async cariSalesAktif(tenantId: string, salesId: string) {
    return this.client.user.findFirst({
      where: { id: salesId, tenantId, isSales: true, isActive: true },
      select: { id: true, name: true },
    });
  }

  /** Pelanggan milik tenant (null bila bukan). */
  async cariPelanggan(tenantId: string, pelangganId: string) {
    return this.client.pelanggan.findFirst({
      where: { id: pelangganId, tenantId },
      select: { id: true, siteId: true, salesId: true, sales: { select: { id: true, name: true } } },
    });
  }

  /** Tetapkan / lepas sales penanggung jawab pelanggan. */
  async tetapkanSales(pelangganId: string, salesId: string | null) {
    return this.client.pelanggan.update({
      where: { id: pelangganId },
      data: { salesId },
      select: { id: true, salesId: true, sales: { select: { id: true, name: true } } },
    });
  }

  /** Pelanggan ISOLIR tenant, opsional dibatasi sales tertentu; jatuh tempo terlama dulu. */
  async daftarIsolir(tenantId: string, saringan: SaringanSales): Promise<BarisPelangganTunggakan[]> {
    return this.client.pelanggan.findMany({
      where: {
        tenantId,
        status: "ISOLIR",
        ...(saringan ? { salesId: { in: saringan.salesIds } } : {}),
      },
      select: PILIH_PELANGGAN_TUNGGAKAN,
      orderBy: [{ jatuhTempo: "asc" }, { id: "asc" }],
    });
  }
}
