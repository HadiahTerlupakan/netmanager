import { PrismaClient, Prisma, AlertType } from "@prisma/client";
import type { Barang, BarangMasuk, BarangKeluar, Gudang } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  USEFUL_LIFE_MONTHS,
  STOCK_FIELD_MAP,
  DEFAULT_KONDISI,
} from "@/lib/constants/inventory";
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

type RestockSettingRecord = {
  id: string;
  tenantId: string | null;
  barangId: string;
  gudangId: string;
  minStok: number;
  maxStok: number;
  barang: {
    id: string;
    kode: string;
    nama: string;
    satuan: string;
  };
  gudang: {
    id: string;
    kode: string;
    nama: string;
  };
};

export class InventoryRepository implements IInventoryDomainRepository {
  private db: PrismaClient;

  constructor() {
    this.db = prisma;
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

    const kondisi = data.kondisi || DEFAULT_KONDISI;
    const stockField = STOCK_FIELD_MAP[kondisi] || "stokBaru";

    await tx.barangGudang.upsert({
      where: {
        barangId_gudangId: { barangId: data.barangId, gudangId: data.gudangId },
      },
      create: {
        id: crypto.randomUUID(),
        barangId: data.barangId,
        gudangId: data.gudangId,
        stok: data.jumlah,
        stokBaru: kondisi === "BARU" ? data.jumlah : 0,
        stokBekas: kondisi === "BEKAS" ? data.jumlah : 0,
        stokRusak: kondisi === "RUSAK" ? data.jumlah : 0,
        updatedAt: new Date(),
        tenantId: data.tenantId || null,
      },
      update: {
        stok: { increment: data.jumlah },
        [stockField]: { increment: data.jumlah },
        updatedAt: new Date(),
      } as Prisma.BarangGudangUpdateInput,
    });

    return masuk as unknown as BarangMasuk;
  }

  async removeStock(data: CreateBarangKeluarInput): Promise<BarangKeluar> {
    return this.db.$transaction(async (tx) => {
      const actor = resolveInventoryActor(data);

      // Ensure integer quantity
      if (Math.floor(data.jumlah) !== data.jumlah)
        throw new Error("Jumlah tidak boleh angka desimal");

      const jumlahInt = data.jumlah;
      if (jumlahInt <= 0) throw new Error("Jumlah harus angka bulat positif");

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
      const stockField = STOCK_FIELD_MAP[kondisi] || "stokBaru";
      const stokByKondisi = currentStock[
        stockField as keyof typeof currentStock
      ] as number;

      if (typeof stokByKondisi !== "number" || isNaN(stokByKondisi))
        throw new Error(`Data stok tidak valid untuk kondisi ${kondisi}`);
      if (stokByKondisi < jumlahInt)
        throw new Error(
          `Stok ${kondisi} tidak mencukupi (Tersedia: ${stokByKondisi})`,
        );

      const updateData = {
        stok: { decrement: jumlahInt },
        [stockField]: { decrement: jumlahInt },
      } as Prisma.BarangGudangUpdateInput;

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

  async findGudangById(id: string): Promise<Gudang | null> {
    return this.db.gudang.findUnique({
      where: { id },
      include: { barangGudang: { include: { barang: true } } },
    }) as unknown as Promise<Gudang | null>;
  }

  async findGudangByKode(kode: string): Promise<Gudang | null> {
    return this.db.gudang.findFirst({ where: { kode } });
  }

  async createGudang(data: CreateGudangInput): Promise<Gudang> {
    const { siteIds, ...gudangData } = data;
    const createData: Prisma.GudangCreateInput = {
      id: crypto.randomUUID(),
      ...gudangData,
      updatedAt: new Date(),
    };
    if (siteIds && siteIds.length > 0)
      createData.sites = { connect: siteIds.map((id) => ({ id })) };
    return this.db.gudang.create({
      data: createData,
      include: { sites: { select: { id: true, name: true, code: true } } },
    }) as unknown as Promise<Gudang>;
  }

  async updateGudang(id: string, data: UpdateGudangInput): Promise<Gudang> {
    return this.db.gudang.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    });
  }

  async deleteGudang(id: string): Promise<void> {
    await this.db.gudang.delete({ where: { id } });
  }

  async hasStockInGudang(id: string): Promise<boolean> {
    const count = await this.db.barangGudang.count({
      where: { gudangId: id, stok: { gt: 0 } },
    });
    return count > 0;
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
    const { skip, take, barangId, dariGudangId, keGudangId, siteId, tenantId } =
      params || {};
    const where: Prisma.TransferAntarGudangWhereInput = { tenantId };
    if (barangId) where.barangId = barangId;
    if (dariGudangId) where.dariGudangId = dariGudangId;
    if (keGudangId) where.keGudangId = keGudangId;
    if (siteId)
      where.OR = [
        { gudangDari: { sites: { some: { id: siteId } } } },
        { gudangKe: { sites: { some: { id: siteId } } } },
      ];
    const queryOptions: Prisma.TransferAntarGudangFindManyArgs = {
      where,
      include: {
        barang: { select: { id: true, kode: true, nama: true, satuan: true } },
        gudangDari: {
          select: { id: true, kode: true, nama: true, lokasi: true },
        },
        gudangKe: {
          select: { id: true, kode: true, nama: true, lokasi: true },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { tanggal: "desc" },
    };
    if (skip !== undefined) queryOptions.skip = skip;
    if (take !== undefined) queryOptions.take = take;
    const [rawItems, total] = await Promise.all([
      this.db.transferAntarGudang.findMany(queryOptions),
      this.db.transferAntarGudang.count({ where }),
    ]);
    const typedRawItems = rawItems as unknown as Array<{
      gudangDari: unknown;
      gudangKe: unknown;
    }>;
    const items = typedRawItems.map((item) => ({
      ...item,
      dariGudang: item.gudangDari,
      keGudang: item.gudangKe,
    }));
    return { items, total };
  }

  async findTransferById(id: string): Promise<Record<string, unknown> | null> {
    const transfer = (await this.db.transferAntarGudang.findUnique({
      where: { id },
      include: {
        barang: { select: { id: true, kode: true, nama: true, satuan: true } },
        gudangDari: {
          select: { id: true, kode: true, nama: true, lokasi: true },
        },
        gudangKe: {
          select: { id: true, kode: true, nama: true, lokasi: true },
        },
        barangMasuk: {
          select: {
            id: true,
            tanggal: true,
            jumlah: true,
            kondisi: true,
            keterangan: true,
          },
        },
        barangKeluar: {
          select: {
            id: true,
            tanggal: true,
            jumlah: true,
            kondisi: true,
            keterangan: true,
          },
        },
      },
    })) as unknown as
      | (Record<string, unknown> & {
          gudangDari?: Record<string, unknown>;
          gudangKe?: Record<string, unknown>;
          barangMasuk?: Record<string, unknown>[];
          barangKeluar?: Record<string, unknown>[];
        })
      | null;

    if (!transfer) {
      return null;
    }

    return {
      ...transfer,
      dariGudang: transfer.gudangDari,
      keGudang: transfer.gudangKe,
      masuk: transfer.barangMasuk?.[0] ?? null,
      keluar: transfer.barangKeluar?.[0] ?? null,
    };
  }

  async createTransfer(
    data: CreateTransferInput,
  ): Promise<Record<string, unknown>> {
    return this.db.$transaction(async (tx) => {
      const {
        barangId,
        dariGudangId,
        keGudangId,
        jumlah,
        kondisi = "BARU",
        tenantId,
      } = data;
      const barang = await tx.barang.findUnique({ where: { id: barangId } });
      if (!barang) throw new Error("Barang tidak ditemukan");
      const [dariGudang, keGudang] = await Promise.all([
        tx.gudang.findUnique({ where: { id: dariGudangId, isActive: true } }),
        tx.gudang.findUnique({ where: { id: keGudangId, isActive: true } }),
      ]);
      if (!dariGudang)
        throw new Error("Gudang sumber tidak ditemukan atau tidak aktif");
      if (!keGudang)
        throw new Error("Gudang tujuan tidak ditemukan atau tidak aktif");
      const stockField = STOCK_FIELD_MAP[kondisi] || "stokBaru";
      const updatedSumber = await tx.barangGudang.updateMany({
        where: {
          barangId,
          gudangId: dariGudangId,
          stok: { gte: jumlah },
          [stockField]: { gte: jumlah },
        },
        data: {
          stok: { decrement: jumlah },
          [stockField]: { decrement: jumlah },
          updatedAt: new Date(),
        } as Prisma.BarangGudangUpdateInput,
      });
      if (updatedSumber.count === 0)
        throw new Error(`Stok ${kondisi.toLowerCase()} tidak mencukupi`);
      const transferCode = `TRF${Date.now()}`;
      const transfer = await tx.transferAntarGudang.create({
        data: {
          id: crypto.randomUUID(),
          kodeTransfer: transferCode,
          barangId,
          dariGudangId,
          keGudangId,
          jumlah,
          kondisi,
          keterangan: data.keterangan || null,
          createdById: data.userId,
          fotoBukti: data.fotoBukti || [],
          fotoMetadata:
            (data.fotoMetadata as unknown as Prisma.InputJsonValue) ||
            Prisma.JsonNull,
          tenantId,
        },
      });
      await tx.barangKeluar.create({
        data: {
          id: crypto.randomUUID(),
          barangId,
          gudangId: dariGudangId,
          transferId: transfer.id,
          jumlah,
          kondisi,
          keterangan: `Transfer ke ${keGudang.nama}`,
          userId: data.userId,
          tenantId,
        },
      });
      await tx.barangMasuk.create({
        data: {
          id: crypto.randomUUID(),
          barangId,
          gudangId: keGudangId,
          transferId: transfer.id,
          jumlah,
          kondisi,
          keterangan: `Transfer dari ${dariGudang.nama}`,
          userId: data.userId,
          tenantId,
        },
      });
      await tx.barangGudang.upsert({
        where: { barangId_gudangId: { barangId, gudangId: keGudangId } },
        create: {
          id: crypto.randomUUID(),
          barangId,
          gudangId: keGudangId,
          stok: jumlah,
          stokBaru: kondisi === "BARU" ? jumlah : 0,
          stokBekas: kondisi === "BEKAS" ? jumlah : 0,
          stokRusak: kondisi === "RUSAK" ? jumlah : 0,
          updatedAt: new Date(),
          tenantId,
        },
        update: {
          stok: { increment: jumlah },
          [stockField]: { increment: jumlah },
          updatedAt: new Date(),
        } as Prisma.BarangGudangUpdateInput,
      });
      return transfer;
    });
  }

  async updateTransfer(
    id: string,
    data: { keterangan?: string },
  ): Promise<Record<string, unknown>> {
    return this.db.transferAntarGudang.update({
      where: { id },
      data,
      include: {
        barang: { select: { id: true, kode: true, nama: true } },
        gudangDari: { select: { id: true, kode: true, nama: true } },
        gudangKe: { select: { id: true, kode: true, nama: true } },
      },
    }) as unknown as Promise<Record<string, unknown>>;
  }

  async deleteTransfer(id: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const transfer = await tx.transferAntarGudang.findUnique({
        where: { id },
        include: { barangMasuk: true, barangKeluar: true },
      });
      if (!transfer) throw new Error("Record transfer tidak ditemukan");
      const stockFieldDel = STOCK_FIELD_MAP[transfer.kondisi] || "stokBaru";
      const updatedTujuan = await tx.barangGudang.updateMany({
        where: {
          barangId: transfer.barangId,
          gudangId: transfer.keGudangId,
          stok: { gte: transfer.jumlah },
          [stockFieldDel]: { gte: transfer.jumlah },
        },
        data: {
          stok: { decrement: transfer.jumlah },
          [stockFieldDel]: { decrement: transfer.jumlah },
          updatedAt: new Date(),
        } as Prisma.BarangGudangUpdateInput,
      });
      if (updatedTujuan.count === 0)
        throw new Error("Stok di gudang tujuan tidak mencukupi");
      const stockFieldAdd = STOCK_FIELD_MAP[transfer.kondisi] || "stokBaru";
      await tx.barangGudang.upsert({
        where: {
          barangId_gudangId: {
            barangId: transfer.barangId,
            gudangId: transfer.dariGudangId,
          },
        },
        create: {
          id: crypto.randomUUID(),
          barangId: transfer.barangId,
          gudangId: transfer.dariGudangId,
          stok: transfer.jumlah,
          stokBaru: transfer.kondisi === "BARU" ? transfer.jumlah : 0,
          stokBekas: transfer.kondisi === "BEKAS" ? transfer.jumlah : 0,
          stokRusak: transfer.kondisi === "RUSAK" ? transfer.jumlah : 0,
          updatedAt: new Date(),
          tenantId: transfer.tenantId,
        },
        update: {
          stok: { increment: transfer.jumlah },
          [stockFieldAdd]: { increment: transfer.jumlah },
          updatedAt: new Date(),
        } as Prisma.BarangGudangUpdateInput,
      });
      await tx.barangMasuk.deleteMany({ where: { transferId: id } });
      await tx.barangKeluar.deleteMany({ where: { transferId: id } });
      await tx.transferAntarGudang.delete({ where: { id } });
    });
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
    const {
      skip,
      take,
      barangId,
      gudangId,
      startDate,
      endDate,
      search,
      siteId,
      tenantId,
    } = params || {};
    const where: Prisma.BarangMasukWhereInput = { tenantId };
    if (barangId) where.barangId = barangId;
    if (gudangId) where.gudangId = gudangId;
    if (siteId) where.gudang = { sites: { some: { id: siteId } } };
    if (search)
      where.OR = [
        { barang: { nama: { contains: search, mode: "insensitive" } } },
        { barang: { kode: { contains: search, mode: "insensitive" } } },
        { gudang: { nama: { contains: search, mode: "insensitive" } } },
        { user: { name: { contains: search, mode: "insensitive" } } },
      ];
    if (startDate || endDate) {
      where.tanggal = {};
      if (startDate) where.tanggal.gte = startDate;
      if (endDate) where.tanggal.lte = endDate;
    }
    const total = await this.db.barangMasuk.count({ where });
    const queryOptions: Prisma.BarangMasukFindManyArgs = {
      where,
      include: {
        barang: true,
        gudang: true,
        user: { select: { id: true, name: true } },
      },
      orderBy: { tanggal: "desc" },
    };
    if (skip !== undefined) queryOptions.skip = skip;
    if (take !== undefined) queryOptions.take = take;
    const items = (await this.db.barangMasuk.findMany(
      queryOptions,
    )) as BarangMasukWithRelations[];
    return { items, total };
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
    const {
      skip,
      take,
      barangId,
      gudangId,
      startDate,
      endDate,
      search,
      siteId,
      tenantId,
    } = params || {};
    const where: Prisma.BarangKeluarWhereInput = { tenantId };
    if (barangId) where.barangId = barangId;
    if (gudangId) where.gudangId = gudangId;
    if (siteId) where.gudang = { sites: { some: { id: siteId } } };
    if (search)
      where.OR = [
        { barang: { nama: { contains: search, mode: "insensitive" } } },
        { barang: { kode: { contains: search, mode: "insensitive" } } },
        { gudang: { nama: { contains: search, mode: "insensitive" } } },
        { user: { name: { contains: search, mode: "insensitive" } } },
      ];
    if (startDate || endDate) {
      where.tanggal = {};
      if (startDate) where.tanggal.gte = startDate;
      if (endDate) where.tanggal.lte = endDate;
    }
    const total = await this.db.barangKeluar.count({ where });
    const queryOptions: Prisma.BarangKeluarFindManyArgs = {
      where,
      include: {
        barang: true,
        gudang: true,
        user: { select: { id: true, name: true } },
      },
      orderBy: { tanggal: "desc" },
    };
    if (skip !== undefined) queryOptions.skip = skip;
    if (take !== undefined) queryOptions.take = take;
    const items = (await this.db.barangKeluar.findMany(
      queryOptions,
    )) as BarangKeluarWithRelations[];
    return { items, total };
  }

  async getMasukRecord(id: string): Promise<InventoryMasukRecord | null> {
    return this.db.barangMasuk.findUnique({
      where: { id },
      include: {
        barang: { select: { id: true, kode: true, nama: true, satuan: true } },
        gudang: {
          select: {
            id: true,
            kode: true,
            nama: true,
            sites: { select: { id: true } },
          },
        },
      },
    }) as unknown as Promise<InventoryMasukRecord | null>;
  }

  async updateMasuk(input: UpdateBarangMasukInput): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const currentRecord = await tx.barangMasuk.findUnique({
        where: { id: input.id },
        include: { barang: true, gudang: true },
      });
      if (!currentRecord)
        throw new Error("Record barang masuk tidak ditemukan");

      const stockDifference = input.jumlah - currentRecord.jumlah;
      const kondisiBaru = (input.kondisi ||
        currentRecord.kondisi) as keyof typeof STOCK_FIELD_MAP;

      await tx.barangMasuk.update({
        where: { id: input.id },
        data: {
          jumlah: input.jumlah,
          kondisi: kondisiBaru,
          keterangan: input.keterangan,
        },
      });

      const currentStock = await tx.barangGudang.findUnique({
        where: {
          barangId_gudangId: {
            barangId: currentRecord.barangId,
            gudangId: currentRecord.gudangId,
          },
        },
      });

      if (!currentStock) {
        const newStockField = STOCK_FIELD_MAP[kondisiBaru] || "stokBaru";
        await tx.barangGudang.create({
          data: {
            id: crypto.randomUUID(),
            barangId: currentRecord.barangId,
            gudangId: currentRecord.gudangId,
            stok: input.jumlah,
            [newStockField]: input.jumlah,
            updatedAt: new Date(),
          },
        });
        return;
      }

      const newTotalStock = currentStock.stok + stockDifference;
      if (newTotalStock < 0) throw new Error("Stok tidak bisa negatif");

      const oldKondisi = currentRecord.kondisi as keyof typeof STOCK_FIELD_MAP;
      const oldStockField = STOCK_FIELD_MAP[oldKondisi] || "stokBaru";
      const newStockField = STOCK_FIELD_MAP[kondisiBaru] || "stokBaru";
      const updateData: Record<string, number> = { stok: newTotalStock };

      if (oldStockField === newStockField) {
        const updatedConditionStock =
          Number(
            (currentStock as Record<string, unknown>)[oldStockField] || 0,
          ) + stockDifference;
        if (updatedConditionStock < 0) {
          throw new Error(`Stok ${kondisiBaru} tidak bisa negatif`);
        }
        updateData[newStockField] = updatedConditionStock;
      } else {
        const oldConditionStock =
          Number(
            (currentStock as Record<string, unknown>)[oldStockField] || 0,
          ) - currentRecord.jumlah;
        if (oldConditionStock < 0) {
          throw new Error(`Stok ${oldKondisi} tidak bisa negatif`);
        }
        updateData[oldStockField] = oldConditionStock;
        updateData[newStockField] =
          Number(
            (currentStock as Record<string, unknown>)[newStockField] || 0,
          ) + input.jumlah;
      }

      await tx.barangGudang.update({
        where: {
          barangId_gudangId: {
            barangId: currentRecord.barangId,
            gudangId: currentRecord.gudangId,
          },
        },
        data: updateData,
      });
    });
  }

  async deleteMasuk(id: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const masukRecord = await tx.barangMasuk.findUnique({
        where: { id },
        include: { barang: true, gudang: true },
      });
      if (!masukRecord) throw new Error("Record barang masuk tidak ditemukan");

      const currentStock = await tx.barangGudang.findUnique({
        where: {
          barangId_gudangId: {
            barangId: masukRecord.barangId,
            gudangId: masukRecord.gudangId,
          },
        },
      });

      if (currentStock) {
        const newStock = Math.max(0, currentStock.stok - masukRecord.jumlah);
        const stockField =
          STOCK_FIELD_MAP[
            masukRecord.kondisi as keyof typeof STOCK_FIELD_MAP
          ] || "stokBaru";

        if (newStock === 0) {
          await tx.barangGudang.delete({
            where: {
              barangId_gudangId: {
                barangId: masukRecord.barangId,
                gudangId: masukRecord.gudangId,
              },
            },
          });
        } else {
          await tx.barangGudang.update({
            where: {
              barangId_gudangId: {
                barangId: masukRecord.barangId,
                gudangId: masukRecord.gudangId,
              },
            },
            data: {
              stok: newStock,
              [stockField]: Math.max(
                0,
                Number(
                  (currentStock as Record<string, unknown>)[stockField] || 0,
                ) - masukRecord.jumlah,
              ),
            },
          });
        }
      }

      await tx.barangMasuk.delete({ where: { id } });
    });
  }

  async getOpnameRecord(id: string): Promise<InventoryOpnameRecord | null> {
    return this.db.stockOpname.findUnique({
      where: { id },
      include: {
        barang: { select: { id: true, kode: true, nama: true, satuan: true } },
        gudang: { select: { id: true, kode: true, nama: true, lokasi: true } },
      },
    }) as unknown as Promise<InventoryOpnameRecord | null>;
  }

  async updateOpname(
    input: UpdateStockOpnameInput,
  ): Promise<UpdatedStockOpnameResult> {
    return this.db.$transaction(async (tx) => {
      const existingRecord = await tx.stockOpname.findUnique({
        where: { id: input.id },
        include: { barang: true, gudang: true },
      });
      if (!existingRecord)
        throw new Error("Record stock opname tidak ditemukan");

      const currentStock = await tx.barangGudang.findUnique({
        where: {
          barangId_gudangId: {
            barangId: existingRecord.barangId,
            gudangId: existingRecord.gudangId,
          },
        },
      });

      const stokSistem = currentStock?.stok || 0;
      const selisihFisik = input.stokFisik - existingRecord.stokFisik;
      const selisihBaru = input.stokFisik - existingRecord.stokSistem;

      const updatedRecord = await tx.stockOpname.update({
        where: { id: input.id },
        data: {
          stokFisik: input.stokFisik,
          selisih: selisihBaru,
          keterangan: input.keterangan,
          kondisiBaik: input.kondisiBaik ?? existingRecord.kondisiBaik,
          kondisiRusak: input.kondisiRusak ?? existingRecord.kondisiRusak,
          kondisiExpire: input.kondisiExpire ?? existingRecord.kondisiExpire,
          lokasiPenyimpanan: input.lokasiPenyimpanan,
          nomorRak: input.nomorRak,
          nomorBox: input.nomorBox,
          pic: input.pic,
          suhuPenyimpanan:
            input.suhuPenyimpanan !== undefined &&
            input.suhuPenyimpanan !== null
              ? Number(input.suhuPenyimpanan)
              : null,
          kelembaban:
            input.kelembaban !== undefined && input.kelembaban !== null
              ? Number(input.kelembaban)
              : null,
          tanggalExpire: input.tanggalExpire
            ? new Date(input.tanggalExpire)
            : existingRecord.tanggalExpire,
          nomorBatch: input.nomorBatch,
          catatanDetail: input.catatanDetail,
        },
      });

      if (currentStock) {
        await tx.barangGudang.update({
          where: {
            barangId_gudangId: {
              barangId: existingRecord.barangId,
              gudangId: existingRecord.gudangId,
            },
          },
          data: {
            stok: Math.max(0, currentStock.stok + selisihFisik),
            stokBaru: Math.max(0, currentStock.stokBaru + selisihFisik),
          },
        });
      } else if (input.stokFisik > 0) {
        await tx.barangGudang.create({
          data: {
            id: crypto.randomUUID(),
            barangId: existingRecord.barangId,
            gudangId: existingRecord.gudangId,
            stok: input.stokFisik,
            updatedAt: new Date(),
          },
        });
      }

      return {
        record: updatedRecord as unknown as Record<string, unknown>,
        stokSistem,
        selisih: selisihBaru,
      };
    });
  }

  async deleteOpname(id: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const existingRecord = await tx.stockOpname.findUnique({
        where: { id: id.trim() },
      });
      if (!existingRecord)
        throw new Error("Record stock opname tidak ditemukan");

      const currentStock = await tx.barangGudang.findUnique({
        where: {
          barangId_gudangId: {
            barangId: existingRecord.barangId,
            gudangId: existingRecord.gudangId,
          },
        },
      });

      if (currentStock) {
        await tx.barangGudang.update({
          where: {
            barangId_gudangId: {
              barangId: existingRecord.barangId,
              gudangId: existingRecord.gudangId,
            },
          },
          data: {
            stok: Math.max(0, currentStock.stok - existingRecord.selisih),
            stokBaru: Math.max(
              0,
              currentStock.stokBaru - existingRecord.selisih,
            ),
          },
        });
      }

      await tx.stockOpname.delete({ where: { id: id.trim() } });
    });
  }
}
