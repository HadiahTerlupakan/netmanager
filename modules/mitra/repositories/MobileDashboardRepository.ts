import { WorkOrderStatus, type Prisma } from "@prisma/client";
import { prisma, prismaMitra } from "@/modules/database";
import type {
  EmployeeCanvasingQuery,
  EmployeePendingWorkOrderQuery,
  EmployeeWorkOrderCountQuery,
  IMobileDashboardRepository,
  MitraWorkOrderCountQuery,
  PeriodicCountQuery,
} from "../domain/ports/IMobileDashboardRepository";

const CLOSED_WORK_ORDER_STATUSES = ["COMPLETED", "VERIFIED", "CLOSED"] as const;
const ACTIVE_WORK_ORDER_STATUSES = [
  "ASSIGNED",
  "IN_PROGRESS",
  "ON_HOLD",
] as const;

export class MobileDashboardRepository implements IMobileDashboardRepository {
  /** Mengambil profil dashboard mitra. */
  async findMitraDashboardProfile(userId: string, tenantId: string) {
    const mitra = await prismaMitra.mitra.findFirst({
      where: { id: userId, tenantId },
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
      return null;
    }

    return {
      siteId: mitra.siteId,
      mitraType: mitra.mitraType,
      targetHarian: mitra.targetHarian,
      enableFeePelanggan: mitra.enableFeePelanggan,
      mitraRateFeePelanggan: mitra.mitraRateFeePelanggan,
      mixradiusOwnerNames: mitra.mixradiusOwnerNames,
      currentBalance: mitra.mitraWallet?.balance?.toNumber() || 0,
    };
  }

  /** Menghitung WO aktif mitra. */
  countAssignedMitraWorkOrders(query: MitraWorkOrderCountQuery) {
    return prisma.workOrderAssignments.count({
      where: {
        mitraId: query.userId,
        tenantId: query.tenantId,
        workOrders: { status: { in: [...ACTIVE_WORK_ORDER_STATUSES] } },
      },
    });
  }

  /** Menghitung WO selesai mitra sejak periode tertentu. */
  countClosedMitraWorkOrders(query: PeriodicCountQuery) {
    return prisma.workOrderAssignments.count({
      where: {
        mitraId: query.userId,
        tenantId: query.tenantId,
        workOrders: {
          status: { in: [...CLOSED_WORK_ORDER_STATUSES] },
          completedAt: { gte: query.since },
        },
      },
    });
  }

  /** Menghitung WO mitra status ASSIGNED (menunggu dikerjakan). */
  countPendingMitraWorkOrders(query: MitraWorkOrderCountQuery) {
    return prisma.workOrderAssignments.count({
      where: {
        mitraId: query.userId,
        tenantId: query.tenantId,
        workOrders: { status: "ASSIGNED" },
      },
    });
  }

  /** Mengambil profil dashboard employee. */
  findEmployeeDashboardProfile(userId: string, tenantId: string) {
    return prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        siteId: true,
        departmentId: true,
        canvasingTarget: true,
        targetSchema: true,
        userSites: { select: { siteId: true } },
      },
    });
  }

  /** Menghitung WO aktif employee. */
  countAssignedEmployeeWorkOrders(query: EmployeeWorkOrderCountQuery) {
    return prisma.workOrders.count({
      where: {
        assignedToId: query.userId,
        status: { in: [...ACTIVE_WORK_ORDER_STATUSES] },
        tenantId: query.tenantId,
      },
    });
  }

  /** Menghitung WO pending yang dapat diklaim employee. */
  countPendingEmployeeWorkOrders(query: EmployeePendingWorkOrderQuery) {
    return prisma.workOrders.count({
      where: {
        status: WorkOrderStatus.PENDING,
        assignedToId: null,
        tenantId: query.tenantId,
        AND: [
          this.buildDepartmentFilter(query.departmentId),
          this.buildSiteFilter(query.userSiteIds),
        ],
      },
    });
  }

  /** Menghitung WO selesai employee sejak periode tertentu. */
  countClosedEmployeeWorkOrders(query: PeriodicCountQuery) {
    return prisma.workOrders.count({
      where: {
        assignedToId: query.userId,
        status: { in: [...CLOSED_WORK_ORDER_STATUSES] },
        completedAt: { gte: query.since },
        tenantId: query.tenantId,
      },
    });
  }

  /** Menghitung barang keluar employee hari ini. */
  countBarangKeluarToday(query: PeriodicCountQuery) {
    return prisma.barangKeluar.count({
      where: {
        userId: query.userId,
        tanggal: { gte: query.since },
        tenantId: query.tenantId,
      },
    });
  }

  /** Menghitung barang masuk employee hari ini. */
  countBarangMasukToday(query: PeriodicCountQuery) {
    return prisma.barangMasuk.count({
      where: {
        userId: query.userId,
        tanggal: { gte: query.since },
        tenantId: query.tenantId,
      },
    });
  }

  /** Menghitung canvasing monthly reset employee. */
  countMonthlyCanvasing(query: EmployeeCanvasingQuery) {
    return prisma.canvasing.count({
      where: {
        salesId: query.userId,
        status: "APPROVED",
        createdAt: { gte: query.monthStart },
        tenantId: query.tenantId,
      },
    });
  }

  /** Menghitung point claim akumulatif employee. */
  countAccumulatedCanvasing(query: EmployeeCanvasingQuery) {
    return prisma.pointClaim.count({
      where: {
        salesId: query.userId,
        status: "APPROVED",
        isCashedOut: false,
        tenantId: query.tenantId,
      },
    });
  }

  /** Menghitung closing canvasing bulanan mitra. */
  countMitraClosingMonth(query: EmployeeCanvasingQuery) {
    return prisma.canvasing.count({
      where: {
        mitraId: query.userId,
        status: "APPROVED",
        createdAt: { gte: query.monthStart },
        tenantId: query.tenantId,
      },
    });
  }

  private buildDepartmentFilter(
    departmentId: string | null,
  ): Prisma.WorkOrdersWhereInput {
    return departmentId
      ? { OR: [{ departmentId: null }, { departmentId }] }
      : { departmentId: null };
  }

  private buildSiteFilter(userSiteIds: string[]): Prisma.WorkOrdersWhereInput {
    return userSiteIds.length > 0
      ? { OR: [{ siteId: null }, { siteId: { in: userSiteIds } }] }
      : { siteId: null };
  }
}
