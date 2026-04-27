import type { Prisma } from "@prisma/client";
import { WorkOrderStatus } from "@prisma/client";
import { getMixRadiusService } from "@/modules/integrations";
import { prisma, prismaMitra } from "@/modules/database";
import { toStartOfDay } from "@/lib/utils/server-datetime";

const CLOSED_WORK_ORDER_STATUSES = ["COMPLETED", "VERIFIED", "CLOSED"] as const;
const ACTIVE_WORK_ORDER_STATUSES = [
  "ASSIGNED",
  "IN_PROGRESS",
  "ON_HOLD",
] as const;
const DEFAULT_CANVASING_TARGET = 30;
const DEFAULT_TARGET_SCHEMA = "MONTHLY_RESET";
const MIXRADIUS_FETCH_LENGTH = 100000;

const mixRadiusService = getMixRadiusService();

export interface MobileDashboardUserPayload {
  id: string;
  role: string;
  tenantId: string;
}

export class MobileDashboardService {
  /** Build mobile dashboard stats for mitra and regular employee users. */
  async getDashboardStats(payload: MobileDashboardUserPayload) {
    if (payload.role === "MITRA") {
      return this.getMitraDashboardStats(payload.id, payload.tenantId);
    }

    return this.getEmployeeDashboardStats(payload.id, payload.tenantId);
  }

  /** Build dashboard payload for mitra users. */
  private async getMitraDashboardStats(userId: string, tenantId: string) {
    const mitra = await prismaMitra.mitra.findUnique({
      where: { id: userId },
      select: {
        siteId: true,
        mitraType: true,
        targetHarian: true,
        enableFeePelanggan: true,
        mitraRateFeePelanggan: true,
        mixradiusOwnerNames: true,
        mitraWallet: { select: { balance: true } },
      },
    });

    if (!mitra) {
      throw new Error("Mitra tidak ditemukan");
    }

    const periods = this.createDashboardPeriods();
    const [
      workOrdersAssigned,
      woCompletedToday,
      woCompletedWeek,
      woCompletedMonth,
    ] = await Promise.all([
      prisma.workOrderAssignments.count({
        where: {
          mitraId: userId,
          tenantId,
          workOrders: { status: { in: [...ACTIVE_WORK_ORDER_STATUSES] } },
        },
      }),
      prisma.workOrderAssignments.count({
        where: {
          mitraId: userId,
          tenantId,
          workOrders: {
            status: { in: [...CLOSED_WORK_ORDER_STATUSES] },
            completedAt: { gte: periods.today },
          },
        },
      }),
      prisma.workOrderAssignments.count({
        where: {
          mitraId: userId,
          tenantId,
          workOrders: {
            status: { in: [...CLOSED_WORK_ORDER_STATUSES] },
            completedAt: { gte: periods.weekStart },
          },
        },
      }),
      prisma.workOrderAssignments.count({
        where: {
          mitraId: userId,
          tenantId,
          workOrders: {
            status: { in: [...CLOSED_WORK_ORDER_STATUSES] },
            completedAt: { gte: periods.monthStart },
          },
        },
      }),
    ]);

    const salesStats = await this.getMitraSalesStats({
      userId,
      tenantId,
      monthStart: periods.monthStart,
      today: periods.today,
      mitraType: mitra.mitraType,
      targetHarian: mitra.targetHarian,
      enableFeePelanggan: mitra.enableFeePelanggan,
      mitraRateFeePelanggan: mitra.mitraRateFeePelanggan,
      mixradiusOwnerNames: mitra.mixradiusOwnerNames,
      currentBalance: mitra.mitraWallet?.balance?.toNumber() || 0,
    });

    return {
      workOrdersAssigned,
      workOrdersPending: 0,
      woCompletedToday,
      woCompletedWeek,
      woCompletedMonth,
      barangKeluarToday: 0,
      barangMasukToday: 0,
      targetHarian: salesStats.targetHarian,
      suksesClosingMonth: salesStats.suksesClosingMonth,
      saldoKomisi: salesStats.saldoKomisi,
      activeCustomers: salesStats.activeCustomers,
      enableFeePelanggan: mitra.enableFeePelanggan || false,
    };
  }

  /** Build dashboard payload for employee users. */
  private async getEmployeeDashboardStats(userId: string, tenantId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        siteId: true,
        departmentId: true,
        userSites: { select: { siteId: true } },
      },
    });

    if (!user) {
      throw new Error("User tidak ditemukan");
    }

    const userSiteIds = this.extractUserSiteIds(user.siteId, user.userSites);
    const periods = this.createDashboardPeriods();
    const pendingWhere = this.buildPendingWorkOrderWhere(
      tenantId,
      user.departmentId,
      userSiteIds,
    );

    const [
      workOrdersAssigned,
      workOrdersPending,
      woCompletedToday,
      woCompletedWeek,
      woCompletedMonth,
      barangKeluarToday,
      barangMasukToday,
      userDetails,
    ] = await Promise.all([
      prisma.workOrders.count({
        where: {
          assignedToId: userId,
          status: { in: [...ACTIVE_WORK_ORDER_STATUSES] },
          tenantId,
        },
      }),
      prisma.workOrders.count({ where: pendingWhere }),
      prisma.workOrders.count({
        where: {
          assignedToId: userId,
          status: { in: [...CLOSED_WORK_ORDER_STATUSES] },
          completedAt: { gte: periods.today },
          tenantId,
        },
      }),
      prisma.workOrders.count({
        where: {
          assignedToId: userId,
          status: { in: [...CLOSED_WORK_ORDER_STATUSES] },
          completedAt: { gte: periods.weekStart },
          tenantId,
        },
      }),
      prisma.workOrders.count({
        where: {
          assignedToId: userId,
          status: { in: [...CLOSED_WORK_ORDER_STATUSES] },
          completedAt: { gte: periods.monthStart },
          tenantId,
        },
      }),
      prisma.barangKeluar.count({
        where: { userId, tanggal: { gte: periods.today }, tenantId },
      }),
      prisma.barangMasuk.count({
        where: { userId, tanggal: { gte: periods.today }, tenantId },
      }),
      prisma.user.findFirst({
        where: { id: userId, tenantId },
        select: { canvasingTarget: true, targetSchema: true },
      }),
    ]);

    const targetSchema = userDetails?.targetSchema || DEFAULT_TARGET_SCHEMA;
    const unclaimedCanvasing = await this.getEmployeeCanvasingProgress({
      userId,
      tenantId,
      targetSchema,
      monthStart: periods.monthStart,
    });

    return {
      workOrdersAssigned,
      workOrdersPending,
      woCompletedToday,
      woCompletedWeek,
      woCompletedMonth,
      barangKeluarToday,
      barangMasukToday,
      unclaimedCanvasing,
      canvasingTarget: userDetails?.canvasingTarget || DEFAULT_CANVASING_TARGET,
      targetSchema,
    };
  }

  /** Build date boundaries used by the mobile dashboard. */
  private createDashboardPeriods() {
    const now = new Date();
    const today = new Date(now);
    today.setTime(toStartOfDay(today).getTime());

    const weekStart = new Date(now);
    const dayOfWeek = weekStart.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    weekStart.setDate(weekStart.getDate() - diff);
    weekStart.setTime(toStartOfDay(weekStart).getTime());

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setTime(toStartOfDay(monthStart).getTime());

    return { today, weekStart, monthStart };
  }

  /** Extract effective site ids for an employee. */
  private extractUserSiteIds(
    siteId: string | null,
    userSites: Array<{ siteId: string }>,
  ) {
    if (userSites.length > 0) {
      return userSites.map((userSite) => userSite.siteId);
    }

    return siteId ? [siteId] : [];
  }

  /** Build pending WO access filter consistent with available mobile WO route. */
  private buildPendingWorkOrderWhere(
    tenantId: string,
    departmentId: string | null,
    userSiteIds: string[],
  ): Prisma.WorkOrdersWhereInput {
    const departmentFilter: Prisma.WorkOrdersWhereInput = departmentId
      ? { OR: [{ departmentId: null }, { departmentId }] }
      : { departmentId: null };
    const siteFilter: Prisma.WorkOrdersWhereInput =
      userSiteIds.length > 0
        ? { OR: [{ siteId: null }, { siteId: { in: userSiteIds } }] }
        : { siteId: null };

    return {
      status: WorkOrderStatus.PENDING,
      assignedToId: null,
      tenantId,
      AND: [departmentFilter, siteFilter],
    };
  }

  /** Resolve employee canvasing progress based on target schema. */
  private async getEmployeeCanvasingProgress(input: {
    userId: string;
    tenantId: string;
    targetSchema: string;
    monthStart: Date;
  }) {
    if (input.targetSchema === "ACCUMULATED") {
      return prisma.pointClaim.count({
        where: {
          salesId: input.userId,
          status: "APPROVED",
          isCashedOut: false,
          tenantId: input.tenantId,
        },
      });
    }

    return prisma.canvasing.count({
      where: {
        salesId: input.userId,
        status: "APPROVED",
        createdAt: { gte: input.monthStart },
        tenantId: input.tenantId,
      },
    });
  }

  /** Build extra sales metrics for mitra sales users. */
  private async getMitraSalesStats(input: {
    userId: string;
    tenantId: string;
    monthStart: Date;
    today: Date;
    mitraType: string;
    targetHarian: number | null;
    enableFeePelanggan: boolean | null;
    mitraRateFeePelanggan: number | null;
    mixradiusOwnerNames: string[];
    currentBalance: number;
  }) {
    if (input.mitraType !== "MITRA_SALES") {
      return {
        targetHarian: 0,
        suksesClosingMonth: 0,
        saldoKomisi: 0,
        activeCustomers: 0,
      };
    }

    const suksesClosingMonth = await prisma.canvasing.count({
      where: {
        mitraId: input.userId,
        status: "APPROVED",
        createdAt: { gte: input.monthStart },
        tenantId: input.tenantId,
      },
    });

    const feeStats = input.enableFeePelanggan
      ? await this.getMitraFeePelangganStats({
          monthStart: input.monthStart,
          today: input.today,
          ownerNames: input.mixradiusOwnerNames,
          feeRate: input.mitraRateFeePelanggan || 0,
        })
      : { activeCustomers: 0, totalFeePelanggan: 0 };

    return {
      targetHarian: input.targetHarian || 0,
      suksesClosingMonth,
      saldoKomisi: input.currentBalance + feeStats.totalFeePelanggan,
      activeCustomers: feeStats.activeCustomers,
    };
  }

  /** Calculate mitra customer fee stats from MixRadius income data. */
  private async getMitraFeePelangganStats(input: {
    monthStart: Date;
    today: Date;
    ownerNames: string[];
    feeRate: number;
  }) {
    try {
      const startDate = input.monthStart.toISOString().split("T")[0] || "";
      const endDate = input.today.toISOString().split("T")[0] || "";
      const incomeResult = await mixRadiusService.fetchIncomeByPeriod({
        startDate,
        endDate,
        length: MIXRADIUS_FETCH_LENGTH,
      });

      if (!incomeResult?.data?.length) {
        return { activeCustomers: 0, totalFeePelanggan: 0 };
      }

      const allowedOwners = this.buildAllowedOwnerSet(input.ownerNames);
      const filteredData = incomeResult.data.filter(
        (item: { owner_name?: string }) =>
          this.isAllowedOwner(item.owner_name, allowedOwners),
      );
      const uniqueMembers = new Set<string>();

      filteredData.forEach(
        (record: { member_id?: string; invoice: string }) => {
          const identifier =
            record.member_id === "0" || !record.member_id
              ? record.invoice
              : record.member_id;

          if (identifier) {
            uniqueMembers.add(identifier);
          }
        },
      );

      const activeCustomers = uniqueMembers.size;
      return {
        activeCustomers,
        totalFeePelanggan: activeCustomers * input.feeRate,
      };
    } catch {
      return { activeCustomers: 0, totalFeePelanggan: 0 };
    }
  }

  /** Build normalized owner aliases for MixRadius filtering. */
  private buildAllowedOwnerSet(ownerNames: string[]) {
    const allowedOwners = new Set<string>();

    ownerNames.forEach((ownerName) => {
      const normalized = ownerName.toLowerCase().trim();
      allowedOwners.add(normalized);
      allowedOwners.add(normalized.split(/[—–-]/)[0]?.trim() || normalized);
    });

    return allowedOwners;
  }

  /** Check whether an income row belongs to the allowed owner set. */
  private isAllowedOwner(
    ownerName: string | undefined,
    allowedOwners: Set<string>,
  ) {
    if (allowedOwners.size === 0) {
      return true;
    }

    if (!ownerName) {
      return false;
    }

    const normalized = ownerName.toLowerCase().trim();
    const prefix = normalized.split(/[—–-]/)[0]?.trim() || normalized;
    return allowedOwners.has(normalized) || allowedOwners.has(prefix);
  }
}

export const mobileDashboardService = new MobileDashboardService();
