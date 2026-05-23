import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { buildPaginationMeta } from "@/lib/utils/pagination";
import { prisma } from "@/modules/database";
import type { Prisma } from "../repositories/prisma-boundary";

import type {
  ListInventoryOpnameInput,
  OpnameHistoryStatsInput,
} from "./InventoryOpnameService";

const INVENTORY_OPNAME_SITE_ONLY_PERMISSION = "opname:site_only";
const DEFAULT_EMPTY_TOTAL = 0;
const DEFAULT_EMPTY_LIST: never[] = [];
const ACCURACY_FULL_PERCENT = 100;
const PERCENT_DECIMAL_PLACES = 0;

export type OpnameHistoryStats = {
  totalRecords: number;
  totalSelisihNol: number;
  akurasiPercent: number;
  totalKondisiBaik: number;
  totalKondisiRusak: number;
  totalKondisiExpire: number;
  totalHilang: number;
  totalPerluPerhatian: number;
};

/** Bangun response kosong ketika user site-only tidak punya site. */
export function buildEmptyOpnameListResponse(input: ListInventoryOpnameInput) {
  return {
    opnameList: DEFAULT_EMPTY_LIST,
    pagination: buildPaginationMeta({
      page: input.page,
      limit: input.limit,
      total: DEFAULT_EMPTY_TOTAL,
    }),
  };
}

/** Bangun filter list opname sesuai input dan scope user. */
export async function buildListOpnameWhere(input: ListInventoryOpnameInput) {
  return buildScopedOpnameWhere(input);
}

/** Bangun filter stats opname dengan input filter saja (tanpa pagination). */
export async function buildListOpnameStatsWhere(
  input: OpnameHistoryStatsInput,
) {
  return buildScopedOpnameWhere(input);
}

/** Ambil list opname beserta totalnya. */
export async function findPagedOpnameRecords(input: {
  where: Prisma.StockOpnameWhereInput;
  page: number;
  limit: number;
}) {
  const [opnameList, total] = await Promise.all([
    prisma.stockOpname.findMany({
      where: input.where,
      include: buildOpnameListInclude(),
      orderBy: { tanggal: "desc" },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
    prisma.stockOpname.count({ where: input.where }),
  ]);

  return {
    opnameList,
    pagination: buildPaginationMeta({
      page: input.page,
      limit: input.limit,
      total,
    }),
  };
}

/** Hitung agregat statistik Riwayat Opname terhadap dataset terfilter. */
export async function computeOpnameHistoryStats(
  where: Prisma.StockOpnameWhereInput | null,
): Promise<OpnameHistoryStats> {
  if (!where) return buildEmptyHistoryStats();

  const [totalRecords, totalSelisihNol, kondisiAggregate, hilangAggregate] =
    await Promise.all([
      prisma.stockOpname.count({ where }),
      prisma.stockOpname.count({ where: { ...where, selisih: 0 } }),
      prisma.stockOpname.aggregate({
        where,
        _sum: {
          kondisiBaik: true,
          kondisiRusak: true,
          kondisiExpire: true,
        },
      }),
      prisma.stockOpname.findMany({
        where: { ...where, alasanSelisih: "hilang" },
        select: { selisih: true },
      }),
    ]);

  const totalKondisiBaik = kondisiAggregate._sum.kondisiBaik ?? 0;
  const totalKondisiRusak = kondisiAggregate._sum.kondisiRusak ?? 0;
  const totalKondisiExpire = kondisiAggregate._sum.kondisiExpire ?? 0;
  const totalHilang = hilangAggregate.reduce(
    (sum, record) => sum + Math.abs(record.selisih),
    0,
  );

  const akurasiPercent =
    totalRecords > 0
      ? roundPercent((totalSelisihNol / totalRecords) * ACCURACY_FULL_PERCENT)
      : ACCURACY_FULL_PERCENT;

  return {
    totalRecords,
    totalSelisihNol,
    akurasiPercent,
    totalKondisiBaik,
    totalKondisiRusak,
    totalKondisiExpire,
    totalHilang,
    totalPerluPerhatian: totalKondisiRusak + totalHilang,
  };
}

async function buildScopedOpnameWhere(
  input: OpnameHistoryStatsInput,
): Promise<Prisma.StockOpnameWhereInput | null> {
  const where = buildBaseOpnameWhere(input);
  const siteId = await resolveSiteOnlyOpnameScope(input);

  if (siteId === null) return null;
  if (siteId) where.gudang = { sites: { some: { id: siteId } } };
  return where;
}

function buildBaseOpnameWhere(input: OpnameHistoryStatsInput) {
  const where: Prisma.StockOpnameWhereInput = {};
  if (input.barangId) where.barangId = input.barangId;
  if (input.gudangId) where.gudangId = input.gudangId;
  if (input.alasanSelisih) where.alasanSelisih = input.alasanSelisih;

  const tanggalRange = buildTanggalRange(input);
  if (tanggalRange) where.tanggal = tanggalRange;

  return where;
}

function buildTanggalRange(input: OpnameHistoryStatsInput) {
  const range: { gte?: Date; lte?: Date } = {};
  if (input.tanggalMulai) {
    const start = new Date(input.tanggalMulai);
    if (!Number.isNaN(start.getTime())) range.gte = start;
  }
  if (input.tanggalSelesai) {
    const end = new Date(input.tanggalSelesai);
    if (!Number.isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      range.lte = end;
    }
  }
  return Object.keys(range).length > 0 ? range : null;
}

async function resolveSiteOnlyOpnameScope(input: OpnameHistoryStatsInput) {
  const [permissions, dbUser] = await Promise.all([
    getUserPermissions(input.user.id),
    prisma.user.findUnique({
      where: { id: input.user.id },
      select: { siteId: true },
    }),
  ]);

  if (isSuperAdmin(input.user as never)) return undefined;
  if (!permissions.includes(INVENTORY_OPNAME_SITE_ONLY_PERMISSION))
    return undefined;
  return dbUser?.siteId ?? input.user.siteId ?? null;
}

function buildOpnameListInclude() {
  return {
    barang: { select: { id: true, kode: true, nama: true, satuan: true } },
    gudang: { select: { id: true, kode: true, nama: true } },
  };
}

function buildEmptyHistoryStats(): OpnameHistoryStats {
  return {
    totalRecords: 0,
    totalSelisihNol: 0,
    akurasiPercent: ACCURACY_FULL_PERCENT,
    totalKondisiBaik: 0,
    totalKondisiRusak: 0,
    totalKondisiExpire: 0,
    totalHilang: 0,
    totalPerluPerhatian: 0,
  };
}

function roundPercent(value: number) {
  const factor = Math.pow(10, PERCENT_DECIMAL_PLACES);
  return Math.round(value * factor) / factor;
}
