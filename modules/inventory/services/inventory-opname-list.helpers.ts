import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { buildPaginationMeta } from "@/lib/utils/pagination";
import { prisma } from "@/modules/database";
import type { Prisma } from "../repositories/prisma-boundary";

import type { ListInventoryOpnameInput } from "./InventoryOpnameService";

const INVENTORY_OPNAME_SITE_ONLY_PERMISSION = "opname:site_only";
const DEFAULT_EMPTY_TOTAL = 0;
const DEFAULT_EMPTY_LIST: never[] = [];

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
  const where = buildBaseOpnameWhere(input);
  const siteId = await resolveSiteOnlyOpnameScope(input);

  if (siteId === null) return null;
  if (siteId) where.gudang = { sites: { some: { id: siteId } } };
  return where;
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

function buildBaseOpnameWhere(input: ListInventoryOpnameInput) {
  const where: Prisma.StockOpnameWhereInput = {};
  if (input.barangId) where.barangId = input.barangId;
  if (input.gudangId) where.gudangId = input.gudangId;
  return where;
}

async function resolveSiteOnlyOpnameScope(input: ListInventoryOpnameInput) {
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
