import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type {
  BarangWithStock,
  BarangDetail,
  BarangMasukWithRelations,
  BarangKeluarWithRelations,
  UpdateBarangInput,
} from "../domain/ports/IInventoryOperationRepository";
import type { CreateInventoryBarangData } from "../domain/ports/IInventoryOperationRepository";
import { InventoryBarangMapper } from "../mappers/InventoryBarangMapper";

/** Resolve transaksi actor inventory dari actor mobile/web atau userId langsung. */
export function resolveInventoryActor(input: {
  actor?: { type: string; id: string; userId?: string | null };
  userId?: string;
}) {
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
    return { actorType: null, actorId: null, userId: null };
  }

  return {
    actorType: "user",
    actorId: input.userId,
    userId: input.userId,
  };
}

/** Ambil daftar barang inventory dan map ke domain entity. */
export async function findAllInventoryBarang(
  db: PrismaClient,
  params?: {
    skip?: number;
    take?: number;
    search?: string;
    gudangId?: string;
    siteId?: string;
    tenantId?: string;
  },
) {
  const where = buildBarangListWhere(params);
  const total = await db.barang.count({ where });
  const items = (await db.barang.findMany(
    buildBarangListQuery(params, where),
  )) as unknown as BarangWithStock[];

  return {
    items: items.map((item) => InventoryBarangMapper.toDomain(item)),
    total,
  };
}

/** Ambil barang by id beserta relasi stok gudang. */
export function findBarangWithStockById(db: PrismaClient, id: string) {
  return db.barang.findUnique({
    where: { id },
    include: {
      barangGudang: {
        include: {
          gudang: {
            select: { id: true, nama: true, kode: true },
          },
        },
      },
    },
  }) as unknown as Promise<BarangWithStock | null>;
}

/** Ambil barang by kode beserta relasi stok gudang. */
export function findBarangWithStockByKode(db: PrismaClient, kode: string) {
  return db.barang.findFirst({
    where: { kode },
    include: {
      barangGudang: {
        include: {
          gudang: {
            select: { id: true, nama: true, kode: true },
          },
        },
      },
    },
  }) as unknown as Promise<BarangWithStock | null>;
}

/** Buat barang baru lalu map ke domain entity. */
export async function createInventoryBarang(
  db: PrismaClient,
  data: CreateInventoryBarangData,
) {
  const created = await db.barang.create({
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
            select: { id: true, nama: true, kode: true },
          },
        },
      },
    },
  });

  return InventoryBarangMapper.toDomain(created as unknown as BarangWithStock);
}

/** Perbarui master barang dengan validasi perubahan satuan. */
export async function updateInventoryBarang(
  db: PrismaClient,
  id: string,
  data: UpdateBarangInput,
) {
  await ensureUnitChangeAllowed(db, id, data);
  return db.barang.update({
    where: { id },
    data: { ...data, updatedAt: new Date() },
  });
}

/** Ambil detail barang lengkap untuk halaman detail inventory. */
export async function findInventoryBarangDetail(db: PrismaClient, id: string) {
  const result = await db.barang.findUnique({
    where: { id },
    include: buildBarangDetailInclude(),
  });

  if (!result) {
    return null;
  }

  return mapToBarangDetail(result);
}

function buildBarangDetailInclude() {
  return {
    barangGudang: { include: { gudang: true } },
    barang_masuk: {
      include: {
        gudang: { select: { id: true, nama: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { tanggal: "desc" as const },
      take: 10,
    },
    barang_keluar: {
      include: {
        gudang: { select: { id: true, nama: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { tanggal: "desc" as const },
      take: 10,
    },
    stockOpname: {
      include: {
        gudang: { select: { id: true, nama: true } },
      },
      orderBy: { tanggal: "desc" as const },
      take: 10,
    },
  };
}

function mapToBarangDetail(result: Record<string, unknown>) {
  return {
    ...result,
    masuk: result.barang_masuk as unknown as BarangMasukWithRelations[],
    keluar: result.barang_keluar as unknown as BarangKeluarWithRelations[],
    opname: result.stockOpname as unknown as Record<string, unknown>[],
  } as unknown as BarangDetail;
}

/** Hapus barang beserta seluruh relasi mutasi stoknya. */
export async function deleteInventoryBarang(db: PrismaClient, id: string) {
  await db.$transaction(async (tx) => {
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
    ).stockOpname.deleteMany({ where: { barangId: id } });
    await tx.barangGudang.deleteMany({ where: { barangId: id } });
    await tx.barang.delete({ where: { id } });
  });
}

function buildBarangListWhere(params?: { search?: string; tenantId?: string }) {
  const where: Prisma.BarangWhereInput = {
    ...(params?.tenantId ? { tenantId: params.tenantId } : {}),
  };

  if (params?.search) {
    where.OR = [
      { nama: { contains: params.search, mode: "insensitive" } },
      { kode: { contains: params.search, mode: "insensitive" } },
    ];
  }

  return where;
}

function buildBarangListQuery(
  params:
    | {
        skip?: number;
        take?: number;
        gudangId?: string;
        siteId?: string;
      }
    | undefined,
  where: Prisma.BarangWhereInput,
): Prisma.BarangFindManyArgs {
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
            params?.gudangId ? { gudangId: params.gudangId } : {},
            params?.siteId
              ? { gudang: { sites: { some: { id: params.siteId } } } }
              : {},
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
            select: { id: true, nama: true, kode: true },
          },
        },
      },
    },
    orderBy: { nama: "asc" },
  };

  if (params?.skip !== undefined) queryOptions.skip = params.skip;
  if (params?.take !== undefined) queryOptions.take = params.take;

  return queryOptions;
}

async function ensureUnitChangeAllowed(
  db: PrismaClient,
  id: string,
  data: UpdateBarangInput,
) {
  const existingBarang = await db.barang.findUnique({
    where: { id },
    select: { satuan: true },
  });

  if (!existingBarang) {
    throw new Error("Barang tidak ditemukan");
  }

  const isUnitChanged =
    typeof data.satuan === "string" && data.satuan !== existingBarang.satuan;

  if (!isUnitChanged) {
    return;
  }

  const stockCount = await db.barangGudang.count({
    where: { barangId: id, stok: { gt: 0 } },
  });

  if (stockCount > 0) {
    throw new Error(
      "Satuan barang tidak boleh diubah saat stok masih tersedia",
    );
  }
}
