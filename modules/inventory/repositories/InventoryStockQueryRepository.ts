import { Prisma, type Gudang, type PrismaClient } from "@prisma/client";

export class InventoryStockQueryRepository {
  constructor(private readonly db: PrismaClient) {}

  /** Ambil total stok barang pada gudang tertentu. */
  async getStockLevel(barangId: string, gudangId: string): Promise<number> {
    const record = await this.db.barangGudang.findUnique({
      where: { barangId_gudangId: { barangId, gudangId } },
    });
    return record?.stok || 0;
  }

  /** Ambil daftar gudang aktif dengan filter site atau tenant. */
  async getAllGudang(params?: {
    siteId?: string;
    tenantId?: string;
  }): Promise<Gudang[]> {
    const { siteId, tenantId } = params || {};
    const where: Prisma.GudangWhereInput = { isActive: true, tenantId };

    if (siteId) {
      (where as Record<string, unknown>).sites = { some: { id: siteId } };
    }

    return this.db.gudang.findMany({ where, orderBy: { nama: "asc" } });
  }

  /** Ambil breakdown stok per kondisi untuk barang dan gudang. */
  async getStockBreakdown(
    barangId: string,
    gudangId: string,
  ): Promise<{ baru: number; bekas: number; rusak: number; total: number }> {
    const stock = await this.db.barangGudang.findUnique({
      where: { barangId_gudangId: { barangId, gudangId } },
      select: { stokBaru: true, stokBekas: true, stokRusak: true, stok: true },
    });

    if (!stock) {
      return { baru: 0, bekas: 0, rusak: 0, total: 0 };
    }

    return {
      baru: stock.stokBaru,
      bekas: stock.stokBekas,
      rusak: stock.stokRusak,
      total: stock.stok,
    };
  }
}
