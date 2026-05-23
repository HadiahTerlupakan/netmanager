import type { PrismaClient } from "@prisma/client";

const SALES_USER_OVERVIEW_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  canvasingTarget: true,
  targetSchema: true,
  departments: { select: { name: true } },
  sites: { select: { code: true, name: true } },
} as const;

const SALES_USER_DASHBOARD_SELECT = {
  id: true,
  name: true,
  email: true,
  canvasingTarget: true,
  sites: { select: { code: true, name: true } },
} as const;

export type SalesAnalyticsRange = {
  startDate: Date;
  endDate: Date;
};

export class SalesAnalyticsRepository {
  constructor(private readonly db: PrismaClient) {}

  /** Sales user untuk overview list (monthly stats). */
  findSalesUsersForOverview(input?: { allowedSiteIds?: string[] }) {
    const siteFilter =
      input?.allowedSiteIds && input.allowedSiteIds.length > 0
        ? { siteId: { in: input.allowedSiteIds } }
        : {};

    return this.db.user.findMany({
      where: { isSales: true, isActive: true, ...siteFilter },
      select: SALES_USER_OVERVIEW_SELECT,
      orderBy: { name: "asc" },
    });
  }

  /** Sales user untuk dashboard, dengan optional siteId filter eksplisit. */
  findSalesUsersForDashboard(input: {
    allowedSiteIds?: string[];
    siteId?: string | null;
  }) {
    const allowedFilter =
      input.allowedSiteIds && input.allowedSiteIds.length > 0
        ? { siteId: { in: input.allowedSiteIds } }
        : {};

    return this.db.user.findMany({
      where: {
        isSales: true,
        isActive: true,
        ...allowedFilter,
        ...(input.siteId ? { siteId: input.siteId } : {}),
      },
      select: SALES_USER_DASHBOARD_SELECT,
      orderBy: { name: "asc" },
    });
  }

  /** Site list untuk dashboard filter. */
  findActiveSites(input?: { allowedSiteIds?: string[] }) {
    const siteFilter =
      input?.allowedSiteIds && input.allowedSiteIds.length > 0
        ? { id: { in: input.allowedSiteIds } }
        : {};

    return this.db.sites.findMany({
      where: { isActive: true, ...siteFilter },
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    });
  }

  /** Kelompokkan canvasing per (salesId,status) untuk monthly overview. */
  groupCanvasingByStatus(input: {
    salesUserIds: string[];
    range: SalesAnalyticsRange;
  }) {
    return this.db.canvasing.groupBy({
      by: ["salesId", "status"],
      where: {
        salesId: { in: input.salesUserIds },
        createdAt: {
          gte: input.range.startDate,
          lte: input.range.endDate,
        },
      },
      _count: { _all: true },
    });
  }

  /** Kelompokkan canvasing per status untuk satu sales (leaderboard). */
  groupCanvasingForSales(input: {
    salesId: string;
    dateFilter: { createdAt?: { gte: Date; lte: Date } };
  }) {
    return this.db.canvasing.groupBy({
      by: ["status"],
      where: { salesId: input.salesId, ...input.dateFilter },
      _count: { _all: true },
    });
  }

  /** Sum approved point untuk satu sales pada periode tertentu. */
  sumApprovedPointsForSales(input: {
    salesId: string;
    dateFilter: { createdAt?: { gte: Date; lte: Date } };
  }) {
    return this.db.pointClaim.aggregate({
      where: {
        salesId: input.salesId,
        status: "APPROVED",
        ...input.dateFilter,
      },
      _sum: { pointValue: true },
    });
  }

  /** Approved canvasing per sales untuk top sites aggregation. */
  groupApprovedCanvasingBySales(input: {
    salesUserIds: string[];
    dateFilter: { createdAt?: { gte: Date; lte: Date } };
  }) {
    return this.db.canvasing.groupBy({
      by: ["salesId"],
      where: {
        status: "APPROVED",
        salesId: { in: input.salesUserIds },
        ...input.dateFilter,
      },
      _count: { _all: true },
    });
  }

  /** Hitung approved canvasing dalam window waktu. */
  countApprovedCanvasingInRange(input: {
    salesUserIds: string[];
    startDate: Date;
    endDate: Date;
  }) {
    return this.db.canvasing.count({
      where: {
        status: "APPROVED",
        salesId: { in: input.salesUserIds },
        createdAt: { gte: input.startDate, lt: input.endDate },
      },
    });
  }
}
