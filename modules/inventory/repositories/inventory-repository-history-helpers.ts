import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  BarangKeluarWithRelations,
  BarangMasukWithRelations,
} from "./IInventoryRepository";

type HistoryParams = {
  skip?: number;
  take?: number;
  barangId?: string;
  gudangId?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  siteId?: string;
  tenantId?: string;
};

/** Ambil histori barang masuk dengan filter inventory. */
export async function getHistoryMasuk(
  db: PrismaClient,
  params?: HistoryParams,
): Promise<{ items: BarangMasukWithRelations[]; total: number }> {
  const where = buildMasukWhere(params);
  const total = await db.barangMasuk.count({ where });
  const queryOptions: Prisma.BarangMasukFindManyArgs = {
    where,
    include: {
      barang: true,
      gudang: true,
      user: { select: { id: true, name: true } },
    },
    orderBy: { tanggal: "desc" },
    ...(params?.skip !== undefined ? { skip: params.skip } : {}),
    ...(params?.take !== undefined ? { take: params.take } : {}),
  };
  const items = (await db.barangMasuk.findMany(
    queryOptions,
  )) as BarangMasukWithRelations[];
  return { items, total };
}

/** Ambil histori barang keluar dengan filter inventory. */
export async function getHistoryKeluar(
  db: PrismaClient,
  params?: HistoryParams,
): Promise<{ items: BarangKeluarWithRelations[]; total: number }> {
  const where = buildKeluarWhere(params);
  const total = await db.barangKeluar.count({ where });
  const queryOptions: Prisma.BarangKeluarFindManyArgs = {
    where,
    include: {
      barang: true,
      gudang: true,
      user: { select: { id: true, name: true } },
    },
    orderBy: { tanggal: "desc" },
    ...(params?.skip !== undefined ? { skip: params.skip } : {}),
    ...(params?.take !== undefined ? { take: params.take } : {}),
  };
  const items = (await db.barangKeluar.findMany(
    queryOptions,
  )) as BarangKeluarWithRelations[];
  return { items, total };
}

function buildMasukWhere(params?: HistoryParams): Prisma.BarangMasukWhereInput {
  const { barangId, gudangId, startDate, endDate, search, siteId, tenantId } =
    params || {};
  const where: Prisma.BarangMasukWhereInput = { tenantId };
  applyHistoryFilters(where, {
    barangId,
    gudangId,
    startDate,
    endDate,
    search,
    siteId,
  });
  return where;
}

function buildKeluarWhere(
  params?: HistoryParams,
): Prisma.BarangKeluarWhereInput {
  const { barangId, gudangId, startDate, endDate, search, siteId, tenantId } =
    params || {};
  const where: Prisma.BarangKeluarWhereInput = { tenantId };
  applyHistoryFilters(where, {
    barangId,
    gudangId,
    startDate,
    endDate,
    search,
    siteId,
  });
  return where;
}

function applyHistoryFilters(
  where: Prisma.BarangMasukWhereInput | Prisma.BarangKeluarWhereInput,
  input: Omit<HistoryParams, "skip" | "take" | "tenantId">,
) {
  if (input.barangId) where.barangId = input.barangId;
  if (input.gudangId) where.gudangId = input.gudangId;
  if (input.siteId) where.gudang = { sites: { some: { id: input.siteId } } };
  if (input.search) where.OR = buildSearchFilter(input.search);
  if (input.startDate || input.endDate) {
    where.tanggal = {};
    if (input.startDate) where.tanggal.gte = input.startDate;
    if (input.endDate) where.tanggal.lte = input.endDate;
  }
}

function buildSearchFilter(search: string) {
  return [
    { barang: { nama: { contains: search, mode: "insensitive" as const } } },
    { barang: { kode: { contains: search, mode: "insensitive" as const } } },
    { gudang: { nama: { contains: search, mode: "insensitive" as const } } },
    { user: { name: { contains: search, mode: "insensitive" as const } } },
  ];
}
