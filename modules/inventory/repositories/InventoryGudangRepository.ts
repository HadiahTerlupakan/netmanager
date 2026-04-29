import { Prisma, type Gudang, type PrismaClient } from "@prisma/client";
import type {
  CreateGudangInput,
  UpdateGudangInput,
} from "./IInventoryRepository";

export class InventoryGudangRepository {
  constructor(private readonly db: PrismaClient) {}

  /** Find warehouse by id with stock details. */
  async findGudangById(id: string): Promise<Gudang | null> {
    return this.db.gudang.findUnique({
      where: { id },
      include: { barangGudang: { include: { barang: true } } },
    }) as unknown as Promise<Gudang | null>;
  }

  /** Find warehouse by code. */
  async findGudangByKode(kode: string): Promise<Gudang | null> {
    return this.db.gudang.findFirst({ where: { kode } });
  }

  /** Create warehouse with optional site links. */
  async createGudang(data: CreateGudangInput): Promise<Gudang> {
    const { siteIds, ...gudangData } = data;
    const createData: Prisma.GudangCreateInput = {
      id: crypto.randomUUID(),
      ...gudangData,
      updatedAt: new Date(),
    };
    if (siteIds?.length) {
      createData.sites = { connect: siteIds.map((id) => ({ id })) };
    }
    return this.db.gudang.create({
      data: createData,
      include: { sites: { select: { id: true, name: true, code: true } } },
    }) as unknown as Promise<Gudang>;
  }

  /** Update warehouse data. */
  async updateGudang(id: string, data: UpdateGudangInput): Promise<Gudang> {
    return this.db.gudang.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    });
  }

  /** Delete warehouse by id. */
  async deleteGudang(id: string): Promise<void> {
    await this.db.gudang.delete({ where: { id } });
  }

  /** Check whether warehouse still has stock. */
  async hasStockInGudang(id: string): Promise<boolean> {
    const count = await this.db.barangGudang.count({
      where: { gudangId: id, stok: { gt: 0 } },
    });
    return count > 0;
  }
}
