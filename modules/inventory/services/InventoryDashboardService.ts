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
import {
  fetchInventoryDashboardQueries,
  getInventoryStockAlerts,
} from "./inventory-dashboard.queries";

import type {
  InventoryDashboardFilters,
  InventoryDashboardTrendRange,
} from "./inventory-dashboard.queries";

const DEFAULT_TREND_MONTH_OFFSET = 5;
const MAX_TREND_MONTHS = 24;
const RECENT_ACTIVITY_LIMIT = 20;

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
      const dashboardData = await fetchInventoryDashboardQueries(
        filters,
        trendRange,
      );
      const fastMoving = await this.buildFastMovingItems(
        dashboardData.fastMovingData,
      );
      const slowMoving = buildSlowMovingItems(dashboardData.slowMovingData);
      const alerts = await getInventoryStockAlerts(sortStockAlerts, siteId);
      const recentActivities = processRecentActivities({
        masuk: dashboardData.recentMasuk,
        keluar: dashboardData.recentKeluar,
        transfer: dashboardData.recentTransfer,
        limit: RECENT_ACTIVITY_LIMIT,
      });

      return {
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

    if (isSuperAdmin(session) || !hasRestriction) {
      return undefined;
    }

    return session.siteId || undefined;
  }

  /**
   * Build site-aware filters for dashboard queries.
   *
   * Bertipe langsung sebagai `InventoryDashboardFilters` — bukan
   * `Record<string, unknown>` yang dulu dipakai — supaya salah ketik nama kunci
   * atau bentuk filter tertangkap kompilator di sini, bukan lolos sampai ke
   * pemanggilan Prisma.
   */
  private buildFilters(siteId?: string): InventoryDashboardFilters {
    if (!siteId) {
      return { gudangFilter: { isActive: true }, transactionFilter: {} };
    }

    return {
      gudangFilter: { isActive: true, sites: { some: { id: siteId } } },
      transactionFilter: { gudang: { sites: { some: { id: siteId } } } },
    };
  }

  /** Build the trend range from query params or fall back to default months. */
  private buildTrendRange(
    startDate?: string | null,
    endDate?: string | null,
  ): InventoryDashboardTrendRange {
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
      const barang = barangs.find((record) => record.id === item.barangId);
      return {
        id: item.barangId,
        kode: barang?.kode || "-",
        nama: barang?.nama || "Unknown",
        totalKeluar: item._sum.jumlah || 0,
      };
    });
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
