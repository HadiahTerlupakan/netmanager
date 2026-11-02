import { prisma } from "@/lib/prisma";
import type { Prisma, WorkOrderStatus } from "@prisma/client";
import { findWorkOrderMaterialDetail } from "./admin-work-order-material-detail.helpers";
import {
  buildSiteScopeWhere,
  type WorkOrderSiteScope,
} from "./work-order-site-scope";

const DEFAULT_LIMIT = 5;
const LAST_30_DAYS = 30;
const HOURS_TO_MS = 60 * 60 * 1000;
const DAYS_TO_MS = 24 * HOURS_TO_MS;

export interface AdminWorkOrderUserProfile {
  id: string;
  role: string | null;
  departmentId: string | null;
  /** Site utama (kolom legacy `User.siteId`). */
  siteId: string | null;
  /** Seluruh site yang ditugaskan lewat `userSites`. */
  siteIds: string[];
}

export interface ReminderWorkOrderData {
  id: string;
  workOrderNumber: string;
  title: string;
  type: string;
  priority: string;
  status: WorkOrderStatus;
  departmentId: string | null;
  siteId: string | null;
  assignedToId: string | null;
  tenantId: string | null;
}

/** Repository pendukung route admin work order. */
export class AdminWorkOrderRouteRepository {
  /** Ambil profil user minimum untuk RBAC route admin. */
  async findUserProfile(
    userId: string,
  ): Promise<AdminWorkOrderUserProfile | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        departmentId: true,
        siteId: true,
        userSites: { select: { siteId: true } },
        role: { select: { name: true } },
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      role: user.role?.name || null,
      departmentId: user.departmentId,
      siteId: user.siteId,
      siteIds: user.userSites.map((userSite) => userSite.siteId),
    };
  }

  /** Ambil gudang default berdasarkan site user. */
  async findFirstGudangBySite(siteId: string): Promise<string | null> {
    const gudang = await prisma.gudang.findFirst({
      where: { sites: { some: { id: siteId } } },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    return gudang?.id ?? null;
  }

  /**
   * Cek apakah gudang ada di tenant aktif dan — bila `siteId` diisi — tertaut
   * ke site tersebut.
   */
  async isGudangAvailableForSite(
    gudangId: string,
    siteId: string | null,
  ): Promise<boolean> {
    const gudang = await prisma.gudang.findFirst({
      where: {
        id: gudangId,
        ...(siteId ? { sites: { some: { id: siteId } } } : {}),
      },
      select: { id: true },
    });

    return gudang !== null;
  }

  /** Ambil data minimum work order untuk fitur reminder. */
  async findReminderWorkOrderById(
    id: string,
  ): Promise<ReminderWorkOrderData | null> {
    return prisma.workOrders.findUnique({
      where: { id },
      select: {
        id: true,
        workOrderNumber: true,
        title: true,
        type: true,
        priority: true,
        status: true,
        departmentId: true,
        siteId: true,
        assignedToId: true,
        tenantId: true,
      },
    }) as Promise<ReminderWorkOrderData | null>;
  }

  /** Reset relasi canvasing saat work order dihapus permanen. */
  async resetCanvasingByWorkOrderId(workOrderId: string): Promise<void> {
    await prisma.canvasing.updateMany({
      where: { workOrderId },
      data: {
        status: "PENDING",
        workOrderId: null,
        approvedBy: null,
        approvedAt: null,
      },
    });
  }

  /** Ambil detail work order untuk kebutuhan notifikasi update. */
  async findWorkOrderNotificationPayload(id: string) {
    return prisma.workOrders.findUnique({
      where: { id },
      select: {
        id: true,
        workOrderNumber: true,
        title: true,
        type: true,
        priority: true,
        departmentId: true,
        siteId: true,
        assignedToId: true,
        assignedTo: {
          select: { id: true, isActive: true },
        },
      },
    });
  }

  /** Cek apakah user sedang cuti hari ini. */
  async isUserOnApprovedLeave(
    userId: string,
    now: Date = new Date(),
  ): Promise<boolean> {
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const leaveRequest = await prisma.leaveRequest.findFirst({
      where: {
        userId,
        status: "APPROVED",
        startDate: { lte: now },
        endDate: { gte: startOfToday },
      },
      select: { id: true },
    });

    return Boolean(leaveRequest);
  }

  /** Ambil detail material dari activity update work order. */
  async findMaterialDetail(workOrderId: string, updateId: string) {
    return findWorkOrderMaterialDetail({ workOrderId, updateId });
  }

  /** Ambil work order stale untuk cron reminder. */
  async findStaleReminderWorkOrders(now: Date) {
    return prisma.workOrders.findMany({
      where: {
        status: { in: ["PENDING", "ASSIGNED", "IN_PROGRESS"] },
        createdAt: { lte: new Date(now.getTime() - LAST_30_DAYS * DAYS_TO_MS) },
      },
      select: {
        id: true,
        workOrderNumber: true,
        title: true,
        type: true,
        priority: true,
        status: true,
        departmentId: true,
        siteId: true,
        assignedToId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
  }

  /** Hitung total work order customer vs internal. */
  async countWorkOrderTypes(filters: {
    departmentId?: string;
    siteIds?: WorkOrderSiteScope;
  }) {
    const where = this.buildWorkOrderWhere(filters);
    const [customer, internal] = await Promise.all([
      prisma.workOrders.count({ where: { ...where, isInternal: false } }),
      prisma.workOrders.count({ where: { ...where, isInternal: true } }),
    ]);

    return { customer, internal };
  }

  /** Ambil statistik response admin. */
  async getAdminResponseStats(
    dateFrom: Date,
    dateTo: Date,
    scope: { departmentId?: string; siteIds?: WorkOrderSiteScope } = {},
  ) {
    const workOrderRepo = await import("./WorkOrderRepository");
    return new workOrderRepo.WorkOrderRepository(prisma).getAdminResponseStats(
      dateFrom,
      dateTo,
      scope.departmentId,
      scope.siteIds,
    );
  }

  /** Ambil top performer dan top assist admin dashboard. */
  async getTopPerformanceSummary(options: {
    limit?: number;
    dateFrom?: Date;
    dateTo?: Date;
    departmentId?: string;
    siteIds?: WorkOrderSiteScope;
  }) {
    const limit = options.limit ?? DEFAULT_LIMIT;
    const workOrderRepo = await import("./WorkOrderRepository");
    const repository = new workOrderRepo.WorkOrderRepository(prisma);
    const [performers, topAssists] = await Promise.all([
      repository.getTopPerformers(
        limit,
        options.dateFrom,
        options.dateTo,
        options.departmentId,
        options.siteIds,
      ),
      repository.getTopAssists(
        limit,
        options.dateFrom,
        options.dateTo,
        options.departmentId,
        options.siteIds,
      ),
    ]);

    return { performers, topAssists };
  }

  private buildWorkOrderWhere(filters: {
    departmentId?: string;
    siteIds?: WorkOrderSiteScope;
  }): Prisma.WorkOrdersWhereInput {
    return {
      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      ...buildSiteScopeWhere(filters.siteIds),
    };
  }
}
