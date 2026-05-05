import { prisma } from "@/modules/database";

const DEFAULT_LOW_STOCK_THRESHOLD = 10;
const RECENT_QUERY_LIMIT = 10;
const TOP_ITEMS_LIMIT = 10;
const SLOW_MOVING_DAYS = 30;

export interface InventoryDashboardFilters {
  gudangFilter: Record<string, unknown>;
  transactionFilter: Record<string, unknown>;
}

export interface InventoryDashboardTrendRange {
  start: Date;
  end: Date;
  monthStart: Date;
}

/** Jalankan query dashboard inventory utama secara paralel. */
export async function fetchInventoryDashboardQueries(
  filters: InventoryDashboardFilters,
  trendRange: InventoryDashboardTrendRange,
) {
  const stockWhere = buildStockWhere(filters.transactionFilter);
  const slowMovingDate = createDaysAgoDate(SLOW_MOVING_DAYS);
  const monthlyMasukPromise = prisma.barangMasuk.groupBy({
    by: ["tanggal"],
    where: {
      ...filters.transactionFilter,
      tanggal: { gte: trendRange.start, lte: trendRange.end },
    },
    _sum: { jumlah: true },
  });
  const monthlyKeluarPromise = prisma.barangKeluar.groupBy({
    by: ["tanggal"],
    where: {
      ...filters.transactionFilter,
      tanggal: { gte: trendRange.start, lte: trendRange.end },
    },
    _sum: { jumlah: true },
  });

  const [
    totalJenisBarang,
    totalGudang,
    totalAsset,
    barangMasukBulanIni,
    barangKeluarBulanIni,
    stockData,
    lowStockItems,
    monthlyMasuk,
    monthlyKeluar,
    fastMovingData,
    slowMovingData,
    recentMasuk,
    recentKeluar,
    recentTransfer,
  ] = await Promise.all([
    prisma.barang.count(),
    prisma.gudang.count({ where: filters.gudangFilter }),
    prisma.asset.count({ where: { status: "ACTIVE" } }),
    prisma.barangMasuk.count({
      where: {
        ...filters.transactionFilter,
        tanggal: { gte: trendRange.monthStart },
      },
    }),
    prisma.barangKeluar.count({
      where: {
        ...filters.transactionFilter,
        tanggal: { gte: trendRange.monthStart },
      },
    }),
    prisma.barangGudang.aggregate({
      where: stockWhere,
      _sum: { stok: true },
    }),
    prisma.barangGudang
      .count({
        where: { ...stockWhere, stok: { lt: DEFAULT_LOW_STOCK_THRESHOLD } },
      })
      .catch(() => 0),
    monthlyMasukPromise,
    monthlyKeluarPromise,
    prisma.barangKeluar.groupBy({
      by: ["barangId"],
      where: {
        ...filters.transactionFilter,
        tanggal: { gte: trendRange.start, lte: trendRange.end },
      },
      _sum: { jumlah: true },
      orderBy: { _sum: { jumlah: "desc" } },
      take: TOP_ITEMS_LIMIT,
    }),
    prisma.barang.findMany({
      where: {
        barang_keluar: {
          none: {
            tanggal: { gte: slowMovingDate },
          },
        },
      },
      select: {
        id: true,
        kode: true,
        nama: true,
        barang_keluar: {
          orderBy: { tanggal: "desc" },
          take: 1,
          select: { tanggal: true },
        },
      },
      take: TOP_ITEMS_LIMIT,
    }),
    prisma.barangMasuk.findMany({
      where: filters.transactionFilter,
      orderBy: { tanggal: "desc" },
      take: RECENT_QUERY_LIMIT,
      include: {
        barang: { select: { nama: true, kode: true } },
        gudang: { select: { nama: true } },
        user: { select: { name: true } },
      },
    }),
    prisma.barangKeluar.findMany({
      where: filters.transactionFilter,
      orderBy: { tanggal: "desc" },
      take: RECENT_QUERY_LIMIT,
      include: {
        barang: { select: { nama: true, kode: true } },
        gudang: { select: { nama: true } },
        user: { select: { name: true } },
      },
    }),
    prisma.transferAntarGudang.findMany({
      where: buildTransferWhere(stockWhere),
      orderBy: { tanggal: "desc" },
      take: RECENT_QUERY_LIMIT,
      include: {
        barang: { select: { nama: true, kode: true } },
        gudangDari: { select: { nama: true } },
        gudangKe: { select: { nama: true } },
        createdBy: { select: { name: true } },
      },
    }),
  ]);

  return {
    totalJenisBarang,
    totalGudang,
    totalAsset,
    barangMasukBulanIni,
    barangKeluarBulanIni,
    stockData,
    lowStockItems,
    monthlyMasuk,
    monthlyKeluar,
    fastMovingData,
    slowMovingData,
    recentMasuk,
    recentKeluar,
    recentTransfer,
  };
}

/** Ambil alert stok dari setting restock aktif. */
export async function getInventoryStockAlerts(
  sortStockAlerts: <T extends { status: string; currentStock: number }>(
    alerts: T[],
  ) => T[],
  siteId?: string,
) {
  const settings = await prisma.restockSettings.findMany({
    where: {
      isActive: true,
      ...(siteId ? { gudang: { sites: { some: { id: siteId } } } } : {}),
    },
    include: {
      barang: { select: { id: true, kode: true, nama: true } },
      gudang: { select: { id: true, nama: true } },
    },
  });

  const alerts = await Promise.all(
    settings.map(async (setting) => {
      const stock = await prisma.barangGudang.findUnique({
        where: {
          barangId_gudangId: {
            barangId: setting.barangId,
            gudangId: setting.gudangId,
          },
        },
      });

      const currentStock = stock?.stok || 0;
      if (currentStock >= setting.minStok) {
        return null;
      }

      return {
        barangId: setting.barang.id,
        barangKode: setting.barang.kode,
        barangNama: setting.barang.nama,
        gudangId: setting.gudang.id,
        gudangNama: setting.gudang.nama,
        currentStock,
        minStock: setting.minStok,
        status: currentStock === 0 ? "CRITICAL" : "LOW",
      };
    }),
  );

  return sortStockAlerts(
    alerts.filter(
      (alert): alert is NonNullable<typeof alert> => alert !== null,
    ),
  );
}

function buildStockWhere(transactionFilter: Record<string, unknown>) {
  const gudangFilter = transactionFilter.gudang;
  return gudangFilter ? { gudang: gudangFilter } : {};
}

function buildTransferWhere(stockWhere: Record<string, unknown>) {
  if (!("gudang" in stockWhere)) {
    return undefined;
  }

  const gudang = stockWhere.gudang;
  return {
    OR: [{ gudangDari: gudang }, { gudangKe: gudang }],
  };
}

function createDaysAgoDate(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}
