import { PrismaClient, Prisma, AlertType } from "@prisma/client";
import type { Barang, BarangMasuk, BarangKeluar, Gudang } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { USEFUL_LIFE_MONTHS, DEFAULT_KONDISI } from "@/lib/constants/inventory";
import type {
  UpdateBarangInput,
  CreateBarangMasukInput,
  CreateBarangKeluarInput,
  BarangWithStock,
  BarangMasukWithRelations,
  BarangKeluarWithRelations,
  CreateGudangInput,
  UpdateGudangInput,
  CreateTransferInput,
  BarangDetail,
  InventoryActorInput,
  UpdateBarangMasukInput,
  UpdateStockOpnameInput,
  InventoryMasukRecord,
  InventoryOpnameRecord,
  UpdatedStockOpnameResult,
} from "./IInventoryRepository";
import type {
  IInventoryRepository as IInventoryDomainRepository,
  FindInventoryBarangParams,
  CreateInventoryBarangData,
} from "../domain/ports/IInventoryRepository";
import { InventoryBarangMapper } from "../mappers/InventoryBarangMapper";
import {
  assertPositiveIntegerQuantity,
  buildDecrementBarangGudangPayload,
  buildIncrementBarangGudangPayload,
  getConditionStockAmount,
  getStockFieldByCondition,
} from "./inventory-stock-helpers";
import { InventoryGudangRepository } from "./InventoryGudangRepository";
import { InventoryMobileRepository } from "./InventoryMobileRepository";
import { InventoryOpnameRepository } from "./InventoryOpnameRepository";
import type { RestockSettingRecord } from "./inventory-repository.contracts";
import {
  getHistoryKeluar,
  getHistoryMasuk,
} from "./inventory-repository-history-helpers";
import {
  deleteMasuk,
  getMasukRecord,
  updateMasuk,
} from "./inventory-repository-masuk-helpers";
import {
  createTransfer,
  deleteTransfer,
  findAllTransfers,
  findTransferById,
  updateTransfer,
} from "./inventory-repository-transfer-helpers";
type InventoryActorRecord = {
  actorType: string | null;
  actorId: string | null;
  userId: string | null;
};
function resolveInventoryActor(input: {
  actor?: InventoryActorInput;
  userId?: string;
}): InventoryActorRecord {
  if (input.actor) {
    return {
      actorType: input.actor.type,
      actorId: input.actor.id,
      userId:
        input.actor.type === "user"
          ? input.actor.userId || input.actor.id
          : null,
    };
  }
  if (!input.userId) {
    return {
      actorType: null,
      actorId: null,
      userId: null,
    };
  }
  return {
    actorType: "user",
    actorId: input.userId,
    userId: input.userId,
  };
}
export class InventoryRepository implements IInventoryDomainRepository {
  private db: PrismaClient;
  private gudangRepository: InventoryGudangRepository;
  private mobileRepository: InventoryMobileRepository;
  private opnameRepository: InventoryOpnameRepository;
  constructor() {
    this.db = prisma;
    this.gudangRepository = new InventoryGudangRepository(this.db);
    this.mobileRepository = new InventoryMobileRepository(this.db);
    this.opnameRepository = new InventoryOpnameRepository(this.db);
  }
  /** Get active restock settings with item and warehouse info. */
  async findActiveRestockSettings(): Promise<RestockSettingRecord[]> {
    return this.db.restockSettings.findMany({
      where: { isActive: true },
      include: {
        barang: {
          select: {
            id: true,
            kode: true,
            nama: true,
            satuan: true,
          },
        },
        gudang: {
          select: {
            id: true,
            kode: true,
            nama: true,
          },
        },
      },
    }) as Promise<RestockSettingRecord[]>;
  }
  /** Get users who can receive restock notifications. */
  async findRestockNotificationRecipients() {
    return this.db.user.findMany({
      where: {
        isActive: true,
        role: {
          permission: {
            some: {
              resource: "restock",
              action: "read",
            },
          },
        },
      },
      select: { id: true, email: true },
    });
  }
  /** Get stock record for an item in a warehouse. */
  async findBarangGudangStock(barangId: string, gudangId: string) {
    return this.db.barangGudang.findUnique({
      where: {
        barangId_gudangId: {
          barangId,
          gudangId,
        },
      },
    });
  }
  /** Find unresolved restock alert for the same item and warehouse. */
  async findOpenRestockAlert(input: {
    barangId: string;
    gudangId: string;
    alertType: AlertType;
  }) {
    return this.db.restockAlerts.findFirst({
      where: {
        barangId: input.barangId,
        gudangId: input.gudangId,
        alertType: input.alertType,
        isResolved: false,
      },
    });
  }
  /** Create a new restock alert. */
  async createRestockAlert(data: Prisma.RestockAlertsUncheckedCreateInput) {
    return this.db.restockAlerts.create({ data });
  }
  /** Create many inventory notifications. */
  async createNotifications(data: Prisma.NotificationsCreateManyInput[]) {
    return this.db.notifications.createMany({ data });
  }
  /** Get paginated barang records and map them to domain entities. */
  async findAllBarang(params?: FindInventoryBarangParams): Promise<{
    items: import("../domain/entities/InventoryEntity").InventoryBarangEntity[];
    total: number;
  }> {
    const { skip, take, search, gudangId, siteId, tenantId } = params || {};
    const where: Prisma.BarangWhereInput = {
      ...(tenantId ? { tenantId } : {}),
    };
    if (search) {
      where.OR = [
        { nama: { contains: search, mode: "insensitive" } },
        { kode: { contains: search, mode: "insensitive" } },
      ];
    }
    // Count total matches
    const total = await this.db.barang.count({ where });
    const queryOptions: Prisma.BarangFindManyArgs = {
      where,
      select: {
        id: true,
        kode: true,
        nama: true,
        satuan: true,
        isWorkOrderMaterial: true,
        jenis: true,
        kategoriAset: true,
        minStokDefault: true,
        createdAt: true,
        tenantId: true,
        updatedAt: true,
        supplierId: true,
        barangGudang: {
          where: {
            AND: [
              gudangId ? { gudangId } : {},
              siteId ? { gudang: { sites: { some: { id: siteId } } } } : {},
            ],
          },
          select: {
            id: true,
            gudangId: true,
            stok: true,
            stokBaru: true,
            stokBekas: true,
            stokRusak: true,
            gudang: {
              select: {
                id: true,
                nama: true,
                kode: true,
              },
            },
          },
        },
      },
      orderBy: { nama: "asc" },
    };
    if (skip !== undefined) queryOptions.skip = skip;
    if (take !== undefined) queryOptions.take = take;
    const items = (await this.db.barang.findMany(
      queryOptions,
    )) as unknown as BarangWithStock[];
    return {
      items: items.map((item) => InventoryBarangMapper.toDomain(item)),
      total,
    };
  }
  async findBarangById(id: string): Promise<BarangWithStock | null> {
    return this.db.barang.findUnique({
      where: { id },
      include: {
        barangGudang: {
          include: {
            gudang: {
              select: {
                id: true,
                nama: true,
                kode: true,
              },
            },
          },
        },
      },
    }) as unknown as Promise<BarangWithStock | null>;
  }
  async findBarangByKode(kode: string): Promise<BarangWithStock | null> {
    return this.db.barang.findFirst({
      where: { kode },
      include: {
        barangGudang: {
          include: {
            gudang: {
              select: {
                id: true,
                nama: true,
                kode: true,
              },
            },
          },
        },
      },
    }) as unknown as Promise<BarangWithStock | null>;
  }
  async existsBarangByKode(kode: string): Promise<boolean> {
    const count = await this.db.barang.count({
      where: { kode },
    });
    return count > 0;
  }
  /** Create barang and map it to domain entity. */
  async createBarang(data: CreateInventoryBarangData) {
    const created = await this.db.barang.create({
      data: {
        id: crypto.randomUUID(),
        kode: data.kode,
        nama: data.nama,
        satuan: data.satuan,
        isWorkOrderMaterial: data.isWorkOrderMaterial,
        jenis: data.jenis as never,
        kategoriAset: data.kategoriAset as never,
        minStokDefault: data.minStokDefault || 0,
        updatedAt: new Date(),
      },
      include: {
        barangGudang: {
          include: {
            gudang: {
              select: {
                id: true,
                nama: true,
                kode: true,
              },
            },
          },
        },
      },
    });
    return InventoryBarangMapper.toDomain(
      created as unknown as BarangWithStock,
    );
  }
  async updateBarang(id: string, data: UpdateBarangInput): Promise<Barang> {
    const existingBarang = await this.db.barang.findUnique({
      where: { id },
      select: { satuan: true },
    });
    if (!existingBarang) {
      throw new Error("Barang tidak ditemukan");
    }
    const isUnitChanged =
      typeof data.satuan === "string" && data.satuan !== existingBarang.satuan;
    if (isUnitChanged) {
      const stockCount = await this.db.barangGudang.count({
        where: {
          barangId: id,
          stok: { gt: 0 },
        },
      });
      if (stockCount > 0) {
        throw new Error(
          "Satuan barang tidak boleh diubah saat stok masih tersedia",
        );
      }
    }
    return this.db.barang.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }
  async findBarangDetail(id: string): Promise<BarangDetail | null> {
    const result = await this.db.barang.findUnique({
      where: { id },
      include: {
        barangGudang: {
          include: { gudang: true },
        },
        barang_masuk: {
          include: {
            gudang: { select: { id: true, nama: true } },
            user: { select: { id: true, name: true } },
          },
          orderBy: { tanggal: "desc" },
          take: 10,
        },
        barang_keluar: {
          include: {
            gudang: { select: { id: true, nama: true } },
            user: { select: { id: true, name: true } },
          },
          orderBy: { tanggal: "desc" },
          take: 10,
        },
        stockOpname: {
          include: {
            gudang: { select: { id: true, nama: true } },
          },
          orderBy: { tanggal: "desc" },
          take: 10,
        },
      },
    });
    if (!result) return null;
    return {
      ...result,
      masuk: result.barang_masuk as unknown as BarangMasukWithRelations[],
      keluar: result.barang_keluar as unknown as BarangKeluarWithRelations[],
      opname: result.stockOpname as unknown as Record<string, unknown>[],
    } as unknown as BarangDetail;
  }
  async deleteBarang(id: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      await tx.barangMasuk.deleteMany({ where: { barangId: id } });
      await tx.barangKeluar.deleteMany({ where: { barangId: id } });
      await (
        tx as unknown as {
          stockOpname: {
            deleteMany: (args: {
              where: { barangId: string };
            }) => Promise<unknown>;
          };
        }
      ).stockOpname.deleteMany({
        where: { barangId: id },
      });
      await tx.barangGudang.deleteMany({ where: { barangId: id } });
      await tx.barang.delete({ where: { id } });
    });
  }
  async addStock(data: CreateBarangMasukInput): Promise<BarangMasuk> {
    return this.db.$transaction(async (tx) =>
      this.addStockInTransaction(tx, data),
    );
  }
  async addStockInTransaction(
    tx: Prisma.TransactionClient,
    data: CreateBarangMasukInput,
  ): Promise<BarangMasuk> {
    const actor = resolveInventoryActor(data);
    if (data.tenantId) {
      const [barang, gudang] = await Promise.all([
        tx.barang.findFirst({
          where: { id: data.barangId, tenantId: data.tenantId },
          select: { id: true },
        }),
        tx.gudang.findFirst({
          where: { id: data.gudangId, tenantId: data.tenantId },
          select: { id: true },
        }),
      ]);
      if (!barang) throw new Error("Barang tidak ditemukan");
      if (!gudang) throw new Error("Gudang tidak ditemukan");
    }
    const masuk = await tx.barangMasuk.create({
      data: {
        id: crypto.randomUUID(),
        barangId: data.barangId,
        gudangId: data.gudangId,
        jumlah: data.jumlah,
        hargaBeliSatuan: data.hargaBeliSatuan || 0,
        kondisi: data.kondisi || "BARU",
        keterangan: data.keterangan || null,
        supplier: data.supplier || null,
        userId: actor.userId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        tanggal: data.tanggal || new Date(),
        fotoBukti: data.fotoBukti || [],
        fotoMetadata:
          (data.fotoMetadata as unknown as Prisma.InputJsonValue) ||
          Prisma.JsonNull,
        tenantId: data.tenantId || null,
      },
      include: {
        barang: true,
        gudang: true,
        user: { select: { id: true, name: true } },
      },
    });
    if (
      masuk.barang &&
      (masuk.barang as unknown as { jenis: string }).jenis === "ASET"
    ) {
      const kategori = (
        masuk.barang as unknown as {
          kategoriAset: keyof typeof USEFUL_LIFE_MONTHS;
        }
      ).kategoriAset;
      const usefulLife =
        USEFUL_LIFE_MONTHS[kategori] || USEFUL_LIFE_MONTHS.LAINNYA;
      const assetsToCreate = [];
      const prefix = `AST-${masuk.barang.kode}`;
      const dateCode = new Date().toISOString().slice(2, 7).replace("-", "");
      const timestamp = Date.now().toString(36).toUpperCase();
      for (let i = 0; i < data.jumlah; i++) {
        const uniqueSuffix = `${timestamp}${i.toString().padStart(3, "0")}`;
        assetsToCreate.push({
          barangId: data.barangId,
          kodeAsset: `${prefix}-${dateCode}-${uniqueSuffix}`,
          purchaseDate: data.tanggal || new Date(),
          purchasePrice: data.hargaBeliSatuan || 0,
          currentValue: data.hargaBeliSatuan || 0,
          usefulLife: usefulLife,
          residualValue: 0,
          status: "ACTIVE" as const,
          location:
            (masuk as unknown as { gudang: { nama: string } | null }).gudang
              ?.nama || "Gudang Utama",
          assignedTo: null,
          assignedActorType: null,
          assignedActorId: null,
          tenantId: data.tenantId || null,
        });
      }
      if (assetsToCreate.length > 0) {
        await tx.asset.createMany({
          data: assetsToCreate.map((a) => ({ id: crypto.randomUUID(), ...a })),
        });
      }
    }
    const stockMutation = buildIncrementBarangGudangPayload({
      barangId: data.barangId,
      gudangId: data.gudangId,
      quantity: data.jumlah,
      kondisi: data.kondisi,
      tenantId: data.tenantId,
    });
    await tx.barangGudang.upsert({
      where: {
        barangId_gudangId: { barangId: data.barangId, gudangId: data.gudangId },
      },
      create: stockMutation.create,
      update: stockMutation.update,
    });
    return masuk as unknown as BarangMasuk;
  }
  async removeStock(data: CreateBarangKeluarInput): Promise<BarangKeluar> {
    return this.db.$transaction(async (tx) => {
      const actor = resolveInventoryActor(data);
      assertPositiveIntegerQuantity(data.jumlah);
      const jumlahInt = data.jumlah;
      const currentStock = await tx.barangGudang.findUnique({
        where: {
          barangId_gudangId: {
            barangId: data.barangId,
            gudangId: data.gudangId,
          },
        },
      });
      if (!currentStock) throw new Error("Stok tidak ditemukan di gudang ini");
      if (currentStock.stok < jumlahInt)
        throw new Error(
          `Total stok tidak mencukupi (Tersedia: ${currentStock.stok})`,
        );
      const kondisi = data.kondisi || DEFAULT_KONDISI;
      const stockField = getStockFieldByCondition(kondisi);
      const stokByKondisi = getConditionStockAmount(
        currentStock as unknown as Record<string, unknown>,
        stockField,
      );
      if (typeof stokByKondisi !== "number" || isNaN(stokByKondisi))
        throw new Error(`Data stok tidak valid untuk kondisi ${kondisi}`);
      if (stokByKondisi < jumlahInt)
        throw new Error(
          `Stok ${kondisi} tidak mencukupi (Tersedia: ${stokByKondisi})`,
        );
      const updateData = buildDecrementBarangGudangPayload({
        stockField,
        quantity: jumlahInt,
      });
      const updated = await tx.barangGudang.updateMany({
        where: {
          id: currentStock.id,
          stok: { gte: jumlahInt },
          [stockField]: { gte: jumlahInt },
        },
        data: updateData,
      });
      if (updated.count === 0)
        throw new Error(
          `Stok ${kondisi} tidak mencukupi atau telah berubah (Tersedia: ${stokByKondisi})`,
        );
      const keluar = await tx.barangKeluar.create({
        data: {
          id: crypto.randomUUID(),
          barangId: data.barangId,
          gudangId: data.gudangId,
          jumlah: jumlahInt,
          kondisi: data.kondisi || "BARU",
          keterangan: data.keterangan || null,
          tujuanPenggunaan: data.tujuanPenggunaan || null,
          isHilang: data.isHilang || false,
          userId: actor.userId,
          actorType: actor.actorType,
          actorId: actor.actorId,
          tanggal: data.tanggal || new Date(),
          fotoBukti: data.fotoBukti || [],
          fotoMetadata:
            (data.fotoMetadata as unknown as Prisma.InputJsonValue) ||
            Prisma.JsonNull,
          tenantId: data.tenantId || null,
        },
        include: { barang: true, gudang: true },
      });
      const keluarWithRelations = keluar as unknown as {
        barang: { jenis: string };
        gudang: { nama: string };
        keterangan: string | null;
      };
      if (keluarWithRelations.barang?.jenis === "ASET" && !data.isHilang) {
        const assetsToAllocate = await tx.asset.findMany({
          where: {
            barangId: data.barangId,
            status: "ACTIVE",
            location: keluarWithRelations.gudang?.nama,
          },
          orderBy: [{ purchaseDate: "asc" }, { createdAt: "asc" }],
          take: jumlahInt,
        });
        if (assetsToAllocate.length > 0) {
          const assetIds = assetsToAllocate.map((a) => a.id);
          await tx.asset.updateMany({
            where: { id: { in: assetIds } },
            data: {
              status: "INSTALLED",
              location: `Deployed (Ref: ${keluarWithRelations.keterangan || "Barang Keluar"})`,
              assignedTo: actor.userId,
              assignedActorType: actor.actorType,
              assignedActorId: actor.actorId,
            },
          });
        }
      }
      return keluar as unknown as BarangKeluar;
    });
  }
  async getStockLevel(barangId: string, gudangId: string): Promise<number> {
    const record = await this.db.barangGudang.findUnique({
      where: { barangId_gudangId: { barangId, gudangId } },
    });
    return record?.stok || 0;
  }
  async getAllGudang(params?: {
    siteId?: string;
    tenantId?: string;
  }): Promise<Gudang[]> {
    const { siteId, tenantId } = params || {};
    const where: Prisma.GudangWhereInput = { isActive: true, tenantId };
    if (siteId)
      (where as Record<string, unknown>).sites = { some: { id: siteId } };
    return this.db.gudang.findMany({ where, orderBy: { nama: "asc" } });
  }
  async findMobileActorUser(input: { actorId: string; tenantId: string }) {
    return this.mobileRepository.findMobileActorUser(input);
  }
  async findMobileActorMitra(actorId: string) {
    return this.mobileRepository.findMobileActorMitra(actorId);
  }
  async findMobileGudangs(input: { tenantId: string; siteIds?: string[] }) {
    return this.mobileRepository.findMobileGudangs(input);
  }
  async findMobileBarangForMasuk(input: {
    tenantId: string;
    siteIds?: string[];
  }) {
    return this.mobileRepository.findMobileBarangForMasuk(input);
  }
  async findMobileBarangForKeluar(input: {
    tenantId: string;
    gudangId: string;
    siteIds?: string[];
  }) {
    return this.mobileRepository.findMobileBarangForKeluar(input);
  }
  async findMobileGudangSites(input: { gudangId: string; tenantId: string }) {
    return this.mobileRepository.findMobileGudangSites(input);
  }
  async findMobileBarangGudangStock(input: {
    barangId: string;
    gudangId: string;
    tenantId: string;
  }) {
    return this.mobileRepository.findMobileBarangGudangStock(input);
  }
  async findMobileHistoryMasuk(input: {
    where: Record<string, unknown>;
    take: number;
  }) {
    return this.mobileRepository.findMobileHistoryMasuk(input);
  }
  async findMobileHistoryKeluar(input: {
    where: Record<string, unknown>;
    take: number;
  }) {
    return this.mobileRepository.findMobileHistoryKeluar(input);
  }
  async findGudangById(id: string): Promise<Gudang | null> {
    return this.gudangRepository.findGudangById(id);
  }
  async findGudangByKode(kode: string): Promise<Gudang | null> {
    return this.gudangRepository.findGudangByKode(kode);
  }
  async createGudang(data: CreateGudangInput): Promise<Gudang> {
    return this.gudangRepository.createGudang(data);
  }
  async updateGudang(id: string, data: UpdateGudangInput): Promise<Gudang> {
    return this.gudangRepository.updateGudang(id, data);
  }
  async deleteGudang(id: string): Promise<void> {
    await this.gudangRepository.deleteGudang(id);
  }
  async hasStockInGudang(id: string): Promise<boolean> {
    return this.gudangRepository.hasStockInGudang(id);
  }
  async findAllTransfers(params?: {
    skip?: number;
    take?: number;
    barangId?: string;
    dariGudangId?: string;
    keGudangId?: string;
    siteId?: string;
    tenantId?: string;
  }): Promise<{ items: Record<string, unknown>[]; total: number }> {
    return findAllTransfers(this.db, params);
  }
  async findTransferById(id: string): Promise<Record<string, unknown> | null> {
    return findTransferById(this.db, id);
  }
  async createTransfer(
    data: CreateTransferInput,
  ): Promise<Record<string, unknown>> {
    return createTransfer(this.db, data);
  }
  async updateTransfer(
    id: string,
    data: { keterangan?: string },
  ): Promise<Record<string, unknown>> {
    return updateTransfer(this.db, id, data);
  }
  async deleteTransfer(id: string): Promise<void> {
    await deleteTransfer(this.db, id);
  }
  async getStockBreakdown(
    barangId: string,
    gudangId: string,
  ): Promise<{ baru: number; bekas: number; rusak: number; total: number }> {
    const stock = await this.db.barangGudang.findUnique({
      where: { barangId_gudangId: { barangId, gudangId } },
      select: { stokBaru: true, stokBekas: true, stokRusak: true, stok: true },
    });
    if (!stock) return { baru: 0, bekas: 0, rusak: 0, total: 0 };
    return {
      baru: stock.stokBaru,
      bekas: stock.stokBekas,
      rusak: stock.stokRusak,
      total: stock.stok,
    };
  }
  async getHistoryMasuk(params?: {
    skip?: number;
    take?: number;
    barangId?: string;
    gudangId?: string;
    startDate?: Date;
    endDate?: Date;
    search?: string;
    siteId?: string;
    tenantId?: string;
  }): Promise<{ items: BarangMasukWithRelations[]; total: number }> {
    return getHistoryMasuk(this.db, params);
  }
  async getHistoryKeluar(params?: {
    skip?: number;
    take?: number;
    barangId?: string;
    gudangId?: string;
    startDate?: Date;
    endDate?: Date;
    search?: string;
    siteId?: string;
    tenantId?: string;
  }): Promise<{ items: BarangKeluarWithRelations[]; total: number }> {
    return getHistoryKeluar(this.db, params);
  }
  async getMasukRecord(id: string): Promise<InventoryMasukRecord | null> {
    return getMasukRecord(this.db, id);
  }
  async updateMasuk(input: UpdateBarangMasukInput): Promise<void> {
    await updateMasuk(this.db, input);
  }
  async deleteMasuk(id: string): Promise<void> {
    await deleteMasuk(this.db, id);
  }
  async getOpnameRecord(id: string): Promise<InventoryOpnameRecord | null> {
    return this.opnameRepository.getOpnameRecord(id);
  }
  async updateOpname(
    input: UpdateStockOpnameInput,
  ): Promise<UpdatedStockOpnameResult> {
    return this.opnameRepository.updateOpname(input);
  }
  async deleteOpname(id: string): Promise<void> {
    await this.opnameRepository.deleteOpname(id);
  }
}
