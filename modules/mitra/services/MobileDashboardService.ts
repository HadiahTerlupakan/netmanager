import { getMixRadiusService } from "@/modules/integrations";
import { MobileDashboardRepository } from "../repositories/MobileDashboardRepository";
import type { IMobileDashboardRepository } from "../domain/ports/IMobileDashboardRepository";
import {
  createDashboardPeriods,
  extractUserSiteIds,
  getEmployeeCanvasingProgress,
  getMitraFeePelangganStats,
  type MobileDashboardMixRadiusService,
  type MobileDashboardPeriods,
} from "./MobileDashboardService.helpers";

const DEFAULT_CANVASING_TARGET = 30;
const DEFAULT_TARGET_SCHEMA = "MONTHLY_RESET";

export interface MobileDashboardUserPayload {
  id: string;
  role: string;
  tenantId: string;
}

export class MobileDashboardService {
  constructor(
    private readonly repository: IMobileDashboardRepository = new MobileDashboardRepository(),
    private readonly mixRadiusService?: MobileDashboardMixRadiusService,
    private readonly createPeriods: () => MobileDashboardPeriods = createDashboardPeriods,
  ) {}

  /** Build mobile dashboard stats for mitra and regular employee users. */
  async getDashboardStats(payload: MobileDashboardUserPayload) {
    if (payload.role === "MITRA") {
      return this.getMitraDashboardStats(payload.id, payload.tenantId);
    }

    return this.getEmployeeDashboardStats(payload.id, payload.tenantId);
  }

  /** Build dashboard payload for mitra users. */
  private async getMitraDashboardStats(userId: string, tenantId: string) {
    const mitra = await this.repository.findMitraDashboardProfile(
      userId,
      tenantId,
    );

    if (!mitra) {
      throw new Error("Mitra tidak ditemukan");
    }

    const periods = this.createPeriods();
    const [
      workOrdersAssigned,
      woCompletedToday,
      woCompletedWeek,
      woCompletedMonth,
    ] = await Promise.all([
      this.repository.countAssignedMitraWorkOrders({ userId, tenantId }),
      this.repository.countClosedMitraWorkOrders({
        userId,
        tenantId,
        since: periods.today,
      }),
      this.repository.countClosedMitraWorkOrders({
        userId,
        tenantId,
        since: periods.weekStart,
      }),
      this.repository.countClosedMitraWorkOrders({
        userId,
        tenantId,
        since: periods.monthStart,
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
      currentBalance: mitra.currentBalance,
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
    const user = await this.repository.findEmployeeDashboardProfile(
      userId,
      tenantId,
    );

    if (!user) {
      throw new Error("User tidak ditemukan");
    }

    const userSiteIds = extractUserSiteIds(user.siteId, user.userSites);
    const periods = this.createPeriods();
    const [
      workOrdersAssigned,
      workOrdersPending,
      woCompletedToday,
      woCompletedWeek,
      woCompletedMonth,
      barangKeluarToday,
      barangMasukToday,
    ] = await Promise.all([
      this.repository.countAssignedEmployeeWorkOrders({ userId, tenantId }),
      this.repository.countPendingEmployeeWorkOrders({
        tenantId,
        departmentId: user.departmentId,
        userSiteIds,
      }),
      this.repository.countClosedEmployeeWorkOrders({
        userId,
        tenantId,
        since: periods.today,
      }),
      this.repository.countClosedEmployeeWorkOrders({
        userId,
        tenantId,
        since: periods.weekStart,
      }),
      this.repository.countClosedEmployeeWorkOrders({
        userId,
        tenantId,
        since: periods.monthStart,
      }),
      this.repository.countBarangKeluarToday({
        userId,
        tenantId,
        since: periods.today,
      }),
      this.repository.countBarangMasukToday({
        userId,
        tenantId,
        since: periods.today,
      }),
    ]);

    const targetSchema = user.targetSchema || DEFAULT_TARGET_SCHEMA;
    const unclaimedCanvasing = await getEmployeeCanvasingProgress(
      this.repository,
      {
        userId,
        tenantId,
        targetSchema,
        monthStart: periods.monthStart,
      },
    );

    return {
      workOrdersAssigned,
      workOrdersPending,
      woCompletedToday,
      woCompletedWeek,
      woCompletedMonth,
      barangKeluarToday,
      barangMasukToday,
      unclaimedCanvasing,
      canvasingTarget: user.canvasingTarget || DEFAULT_CANVASING_TARGET,
      targetSchema,
    };
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

    const suksesClosingMonth = await this.repository.countMitraClosingMonth({
      userId: input.userId,
      tenantId: input.tenantId,
      monthStart: input.monthStart,
    });

    const feeStats = input.enableFeePelanggan
      ? await getMitraFeePelangganStats(this.getMixRadiusService(), {
          monthStart: input.monthStart,
          today: input.today,
          ownerNames: input.mixradiusOwnerNames,
          feeRate: input.mitraRateFeePelanggan || 0,
          tenantId: input.tenantId,
        })
      : { activeCustomers: 0, totalFeePelanggan: 0 };

    return {
      targetHarian: input.targetHarian || 0,
      suksesClosingMonth,
      saldoKomisi: input.currentBalance + feeStats.totalFeePelanggan,
      activeCustomers: feeStats.activeCustomers,
    };
  }

  private getMixRadiusService(): MobileDashboardMixRadiusService {
    return this.mixRadiusService ?? getMixRadiusService();
  }
}

let mobileDashboardServiceInstance: MobileDashboardService | null = null;

/** Return the shared mobile dashboard service lazily. */
export function getMobileDashboardService(): MobileDashboardService {
  if (!mobileDashboardServiceInstance) {
    mobileDashboardServiceInstance = new MobileDashboardService();
  }

  return mobileDashboardServiceInstance;
}
