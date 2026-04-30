import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseOptionalDate } from "@/lib/utils/server-datetime";
import { prisma } from "@/modules/database";
import {
  accumulateMonthlyData,
  buildSlowMovingItems,
  initializeMonthMap,
  processRecentActivities,
  sortStockAlerts,
} from "./inventory-dashboard.service-helpers";

const DEFAULT_LOW_STOCK_THRESHOLD = 10;
const DEFAULT_TREND_MONTH_OFFSET = 5;
const MAX_TREND_MONTHS = 24;
const RECENT_ACTIVITY_LIMIT = 20;
const RECENT_QUERY_LIMIT = 10;
const TOP_ITEMS_LIMIT = 10;
const SLOW_MOVING_DAYS = 30;
const CRITICAL_STATUS = "CRITICAL";
const LOW_STATUS = "LOW";

interface InventoryDashboardSession {
  id: string;
  siteId?: string | null;
  role?: string;
  isSuperAdmin?: boolean;
}

interface MonthlyData {
  tanggal: Date;
  _sum: { jumlah: number | null };
}

export class InventoryDashboardService {
  /** Get inventory dashboard data using access-aware warehouse filters. */
  async getDashboardData(input: {
    session: InventoryDashboardSession;
    startDate?: string | null;
    endDate?: string | null;
  }) {
    try {
      const permissions = await getUserPermissions(input.session.id);
      const siteId = this.resolveRestrictedSiteId(input.session, permissions);
      const trendRange = this.buildTrendRange(input.startDate, input.endDate);
      const filters = this.buildFilters(siteId);
      const dashboardData = await this.fetchDashboardQueries(
        filters,
        trendRange,
      );
      const fastMoving = await this.buildFastMovingItems(
        dashboardData.fastMovingData,
      );
      const slowMoving = buildSlowMovingItems(dashboardData.slowMovingData);
      const alerts = await this.getStockAlerts(siteId);
      const recentActivities = processRecentActivities({
        masuk: dashboardData.recentMasuk,
        keluar: dashboardData.recentKeluar,
        transfer: dashboardData.recentTransfer,
        limit: RECENT_ACTIVITY_LIMIT,
      });

      return {
        success: true,
        data: {
          stats: {
            totalJenisBarang: dashboardData.totalJenisBarang,
            totalStokUnit: dashboardData.stockData._sum.stok || 0,
            totalGudang: dashboardData.totalGudang,
            totalAsset: dashboardData.totalAsset,
            lowStockItems: dashboardData.lowStockItems,
            barangMasukBulanIni: dashboardData.barangMasukBulanIni,
            barangKeluarBulanIni: dashboardData.barangKeluarBulanIni,
          },
          monthlyTrend: this.processMonthlyTrend(
            dashboardData.monthlyMasuk,
            dashboardData.monthlyKeluar,
            trendRange.start,
            trendRange.end,
          ),
          fastMoving,
          slowMoving,
          alerts,
          recentActivities,
        },
      };
    } catch (error) {
      logger.error("Error fetching inventory dashboard:", error as Error);
      throw error;
    }
  }

  /** Resolve the effective site restriction from permissions. */
  private resolveRestrictedSiteId(
    session: InventoryDashboardSession,
    permissions: string[],
  ) {
    const restrictedPermissions = ["barang:site_only", "gudang:site_only"];
    const hasRestriction = restrictedPermissions.some((permission) =>
      permissions.includes(permission),
    );
    const isSuper = isSuperAdmin(session);

    if (isSuper || !hasRestriction) {
      return undefined;
    }

    return session.siteId || undefined;
  }

  /** Build site-aware filters for dashboard queries. */
  private buildFilters(siteId?: string) {
    const gudangFilter: Record<string, unknown> = { isActive: true };
    const transactionFilter: Record<string, unknown> = {};

    if (!siteId) {
      return { gudangFilter, transactionFilter };
    }

    gudangFilter.sites = { some: { id: siteId } };
    transactionFilter.gudang = { sites: { some: { id: siteId } } };

    return { gudangFilter, transactionFilter };
  }

  /** Build the trend range from query params or fall back to default months. */
  private buildTrendRange(startDate?: string | null, endDate?: string | null) {
    const now = new Date();
    const parsedStart = parseOptionalDate(startDate);
    const parsedEnd = parseOptionalDate(endDate);

    return {
      start:
        parsedStart ||
        new Date(
          now.getFullYear(),
          now.getMonth() - DEFAULT_TREND_MONTH_OFFSET,
          1,
        ),
      end: parsedEnd || now,
      monthStart: new Date(now.getFullYear(), now.getMonth(), 1),
    };
  }

  /** Run the dashboard aggregate queries in parallel. */
  private async fetchDashboardQueries(
    filters: {
      gudangFilter: Record<string, unknown>;
      transactionFilter: Record<string, unknown>;
    },
    trendRange: { start: Date; end: Date; monthStart: Date },
  ) {
    const stockWhere = this.buildStockWhere(filters.transactionFilter);
    const slowMovingDate = this.createDaysAgoDate(SLOW_MOVING_DAYS);

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
      prisma.barangMasuk.groupBy({
        by: ["tanggal"],
        where: {
          ...filters.transactionFilter,
          tanggal: { gte: trendRange.start, lte: trendRange.end },
        },
        _sum: { jumlah: true },
      }),
      prisma.barangKeluar.groupBy({
        by: ["tanggal"],
        where: {
          ...filters.transactionFilter,
          tanggal: { gte: trendRange.start, lte: trendRange.end },
        },
        _sum: { jumlah: true },
      }),
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
        where: this.buildTransferWhere(stockWhere),
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

  /** Build stock where clause from transaction filters. */
  private buildStockWhere(transactionFilter: Record<string, unknown>) {
    const gudangFilter = transactionFilter.gudang;
    return gudangFilter ? { gudang: gudangFilter } : {};
  }

  /** Build transfer filter using site-aware warehouse restriction. */
  private buildTransferWhere(stockWhere: Record<string, unknown>) {
    if (!("gudang" in stockWhere)) {
      return undefined;
    }

    const gudang = stockWhere.gudang;
    return {
      OR: [{ gudangDari: gudang }, { gudangKe: gudang }],
    };
  }

  /** Create a date relative to now by day count. */
  private createDaysAgoDate(days: number) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  /** Enrich grouped fast-moving rows with barang metadata. */
  private async buildFastMovingItems(
    fastMovingData: Array<{
      barangId: string;
      _sum: { jumlah: number | null };
    }>,
  ) {
    const barangIds = fastMovingData.map((item) => item.barangId);
    const barangs = await prisma.barang.findMany({
      where: { id: { in: barangIds } },
      select: { id: true, kode: true, nama: true },
    });

    return fastMovingData.map((item) => {
      const barang = barangs.find(
        (currentBarang) => currentBarang.id === item.barangId,
      );
      return {
        id: item.barangId,
        kode: barang?.kode || "-",
        nama: barang?.nama || "Unknown",
        totalKeluar: item._sum.jumlah || 0,
      };
    });
  }

  /** Build stock alerts from active restock settings. */
  private async getStockAlerts(siteId?: string) {
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
          status: currentStock === 0 ? CRITICAL_STATUS : LOW_STATUS,
        };
      }),
    );

    return sortStockAlerts(
      alerts.filter(
        (alert): alert is NonNullable<typeof alert> => alert !== null,
      ),
    );
  }

  /** Aggregate trend rows into month buckets. */
  private processMonthlyTrend(
    masukData: MonthlyData[],
    keluarData: MonthlyData[],
    startDate: Date,
    endDate: Date,
  ) {
    const monthMap = initializeMonthMap({
      startDate,
      endDate,
      maxTrendMonths: MAX_TREND_MONTHS,
    });
    accumulateMonthlyData(monthMap, masukData, "masuk");
    accumulateMonthlyData(monthMap, keluarData, "keluar");

    return Object.entries(monthMap).map(([key, value]) => {
      const [yearText, monthText] = key.split("-");
      const monthDate = new Date(Number(yearText), Number(monthText) - 1, 1);
      return {
        month: monthDate.toLocaleDateString("id-ID", {
          month: "short",
          year: "numeric",
        }),
        masuk: value.masuk,
        keluar: value.keluar,
      };
    });
  }
}

export const inventoryDashboardService = new InventoryDashboardService();
