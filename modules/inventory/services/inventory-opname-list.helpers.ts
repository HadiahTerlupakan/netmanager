import { fromZonedTime } from "date-fns-tz";

import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import { getTimezone } from "@/lib/utils/get-timezone";
import { buildPaginationMeta } from "@/lib/utils/pagination";
import { prisma } from "@/modules/database";
import { filterSitePrisma, tanpaDataSamaSekali } from "@/modules/roles/client";
import type { Prisma } from "../repositories/prisma-boundary";
import { IZIN_PEMBATAS_OPNAME } from "../domain/izin-pembatas-site";
import { lingkupSiteGudang } from "./lingkup-gudang";

import type {
  ListInventoryOpnameInput,
  OpnameHistoryStatsInput,
} from "./InventoryOpnameService";

const DEFAULT_EMPTY_TOTAL = 0;
const DEFAULT_EMPTY_LIST: never[] = [];
const ACCURACY_FULL_PERCENT = 100;
const PERCENT_DECIMAL_PLACES = 0;
const ALASAN_HILANG = "hilang";
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_LENGTH = 10;
const ONE_DAY = 1;
const MONTH_INDEX_OFFSET = 1;

/** Urutan stabil "terbaru dulu"; dipakai daftar dan penentu opname terakhir. */
const OPNAME_TERBARU_ORDER = [
  { tanggal: "desc" },
  { id: "desc" },
] satisfies Prisma.StockOpnameOrderByWithRelationInput[];

const HILANG_BERKURANG_WHERE = {
  alasanSelisih: ALASAN_HILANG,
  selisih: { lt: 0 },
} satisfies Prisma.StockOpnameWhereInput;

const PERLU_PERHATIAN_WHERE = {
  OR: [{ kondisiRusak: { gt: 0 } }, HILANG_BERKURANG_WHERE],
} satisfies Prisma.StockOpnameWhereInput;

export type OpnameHistoryStats = {
  totalRecords: number;
  totalSelisihNol: number;
  akurasiPercent: number;
  totalKondisiBaik: number;
  totalKondisiRusak: number;
  totalKondisiExpire: number;
  totalHilang: number;
  /** Jumlah catatan opname yang perlu perhatian (bukan jumlah unit). */
  totalPerluPerhatian: number;
};

/** Pasangan barang-gudang yang menjadi kunci "opname terakhir". */
type BarangGudangPair = { barangId: string; gudangId: string };

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

/**
 * Ambil list opname beserta totalnya. Urutan `tanggal desc, id desc` stabil
 * karena satu batch SO berbagi `tanggal` yang sama. Tiap item diberi
 * `isTerbaru` — hanya opname terakhir per barang-gudang yang boleh diubah.
 */
export async function findPagedOpnameRecords(input: {
  where: Prisma.StockOpnameWhereInput;
  page: number;
  limit: number;
}) {
  const [records, total] = await Promise.all([
    prisma.stockOpname.findMany({
      where: input.where,
      include: buildOpnameListInclude(),
      orderBy: OPNAME_TERBARU_ORDER,
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
    prisma.stockOpname.count({ where: input.where }),
  ]);

  const latestIds = await findLatestOpnameIds(records);
  const opnameList = records.map((record) => ({
    ...record,
    isTerbaru: latestIds.has(record.id),
  }));

  return {
    opnameList,
    pagination: buildPaginationMeta({
      page: input.page,
      limit: input.limit,
      total,
    }),
  };
}

/**
 * Kumpulkan id opname terakhir (tanggal desc, id desc) untuk tiap pasangan
 * barang-gudang yang muncul di halaman. Lingkup tenant dijaga ekstensi Prisma;
 * filter site tak perlu karena gudang pasangan sudah lolos filter halaman.
 */
export async function findLatestOpnameIds(
  records: BarangGudangPair[],
): Promise<Set<string>> {
  const pairs = uniqueBarangGudangPairs(records);
  if (pairs.length === 0) return new Set();

  const latest = await prisma.stockOpname.findMany({
    where: { OR: pairs },
    orderBy: OPNAME_TERBARU_ORDER,
    distinct: ["barangId", "gudangId"],
    select: { id: true },
  });
  return new Set(latest.map((record) => record.id));
}

/** Hitung agregat statistik Riwayat Opname terhadap dataset terfilter. */
export async function computeOpnameHistoryStats(
  where: Prisma.StockOpnameWhereInput | null,
): Promise<OpnameHistoryStats> {
  if (!where) return buildEmptyHistoryStats();

  const [
    totalRecords,
    totalSelisihNol,
    kondisiAggregate,
    hilangAggregate,
    totalPerluPerhatian,
  ] = await Promise.all([
    prisma.stockOpname.count({ where }),
    prisma.stockOpname.count({ where: { AND: [where, { selisih: 0 }] } }),
    prisma.stockOpname.aggregate({
      where,
      _sum: {
        kondisiBaik: true,
        kondisiRusak: true,
        kondisiExpire: true,
      },
    }),
    prisma.stockOpname.aggregate({
      where: { AND: [where, HILANG_BERKURANG_WHERE] },
      _sum: { selisih: true },
    }),
    prisma.stockOpname.count({
      where: { AND: [where, PERLU_PERHATIAN_WHERE] },
    }),
  ]);

  const akurasiPercent =
    totalRecords > 0
      ? roundPercent((totalSelisihNol / totalRecords) * ACCURACY_FULL_PERCENT)
      : ACCURACY_FULL_PERCENT;

  return {
    totalRecords,
    totalSelisihNol,
    akurasiPercent,
    totalKondisiBaik: kondisiAggregate._sum.kondisiBaik ?? 0,
    totalKondisiRusak: kondisiAggregate._sum.kondisiRusak ?? 0,
    totalKondisiExpire: kondisiAggregate._sum.kondisiExpire ?? 0,
    // Selisih hilang selalu negatif; dinegasikan agar tampil sebagai unit hilang.
    totalHilang: Math.abs(hilangAggregate._sum.selisih ?? 0),
    totalPerluPerhatian,
  };
}

async function buildScopedOpnameWhere(
  input: OpnameHistoryStatsInput,
): Promise<Prisma.StockOpnameWhereInput | null> {
  const timezone = await resolveTenantTimezone();
  const where = buildBaseOpnameWhere(input, timezone);
  const lingkup = await resolveOpnameLingkup(input);

  if (tanpaDataSamaSekali(lingkup)) return null;
  const sitePrisma = filterSitePrisma(lingkup);
  if (sitePrisma) where.gudang = { sites: { some: { id: sitePrisma } } };
  return where;
}

function buildBaseOpnameWhere(
  input: OpnameHistoryStatsInput,
  timezone: string,
) {
  const where: Prisma.StockOpnameWhereInput = {};
  if (input.barangId) where.barangId = input.barangId;
  if (input.gudangId) where.gudangId = input.gudangId;
  if (input.alasanSelisih) where.alasanSelisih = input.alasanSelisih;

  const tanggalRange = buildTanggalRange(input, timezone);
  if (tanggalRange) where.tanggal = tanggalRange;

  return where;
}

/**
 * Bangun rentang `tanggal` dari filter tanggal (YYYY-MM-DD) dalam zona waktu
 * tenant: `gte` awal hari mulai, `lt` awal hari setelah tanggal selesai.
 * Tidak bergantung pada TZ proses server.
 */
export function buildTanggalRange(
  input: Pick<OpnameHistoryStatsInput, "tanggalMulai" | "tanggalSelesai">,
  timezone: string,
) {
  const range: { gte?: Date; lt?: Date } = {};
  const start = parseStartOfDay(input.tanggalMulai, timezone);
  if (start) range.gte = start;
  const nextDay = addOneDay(input.tanggalSelesai);
  const end = parseStartOfDay(nextDay, timezone);
  if (end) range.lt = end;
  return Object.keys(range).length > 0 ? range : null;
}

function parseStartOfDay(value: string | undefined, timezone: string) {
  if (!value || !DATE_ONLY_PATTERN.test(value)) return null;
  const start = fromZonedTime(`${value}T00:00:00`, timezone);
  return Number.isNaN(start.getTime()) ? null : start;
}

function addOneDay(value: string | undefined) {
  if (!value || !DATE_ONLY_PATTERN.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const next = new Date(
    Date.UTC(year, month - MONTH_INDEX_OFFSET, day + ONE_DAY),
  );
  if (Number.isNaN(next.getTime())) return undefined;
  return next.toISOString().slice(0, ISO_DATE_LENGTH);
}

async function resolveTenantTimezone() {
  const { tenantId } = await getTenantIdFromContext();
  return getTimezone(tenantId ?? undefined);
}

function uniqueBarangGudangPairs(records: BarangGudangPair[]) {
  const seen = new Map<string, BarangGudangPair>();
  for (const { barangId, gudangId } of records) {
    seen.set(`${barangId}::${gudangId}`, { barangId, gudangId });
  }
  return [...seen.values()];
}

/**
 * Lingkup site daftar opname: site utama plus seluruh `userSites`, dengan
 * pembatas yang sama dengan pencatatan dan pembukaan catatan opname.
 */
async function resolveOpnameLingkup(input: OpnameHistoryStatsInput) {
  return lingkupSiteGudang({
    userId: input.user.id,
    permissions: await getUserPermissions(input.user.id),
    isSuperAdmin: isSuperAdmin(input.user as never),
    izinPembatas: IZIN_PEMBATAS_OPNAME,
  });
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
