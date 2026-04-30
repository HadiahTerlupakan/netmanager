import { prisma } from "@/lib/prisma";
import type { Prisma, WorkOrderStatus } from "@prisma/client";
import { findWorkOrderMaterialDetail } from "./admin-work-order-material-detail.helpers";

const DEFAULT_LIMIT = 5;
const LAST_30_DAYS = 30;
const HOURS_TO_MS = 60 * 60 * 1000;
const DAYS_TO_MS = 24 * HOURS_TO_MS;

export interface AdminWorkOrderUserProfile {
  id: string;
  role: string | null;
  departmentId: string | null;
  siteId: string | null;
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
    siteId?: string;
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
    departmentId?: string,
  ) {
    const workOrderRepo = await import("./WorkOrderRepository");
    return new workOrderRepo.WorkOrderRepository(prisma).getAdminResponseStats(
      dateFrom,
      dateTo,
      departmentId,
    );
  }

  /** Ambil top performer dan top assist admin dashboard. */
  async getTopPerformanceSummary(options: {
    limit?: number;
    dateFrom?: Date;
    dateTo?: Date;
    departmentId?: string;
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
      ),
      repository.getTopAssists(
        limit,
        options.dateFrom,
        options.dateTo,
        options.departmentId,
      ),
    ]);

    return { performers, topAssists };
  }

  private buildWorkOrderWhere(filters: {
    departmentId?: string;
    siteId?: string;
  }) {
    const where: Prisma.WorkOrdersWhereInput = {};

    if (filters.departmentId) {
      where.departmentId = filters.departmentId;
    }

    if (filters.siteId) {
      where.siteId = filters.siteId;
    }

    return where;
  }
}
