import { logger } from "@/lib/logger";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/modules/database";
import { createNotification, sendPushToUsers } from "@/modules/notification";
import { WorkOrderRepository } from "../repositories/WorkOrderRepository";
import type { CreateWorkOrderData } from "../domain/ports/IWorkOrderRepository";

export interface MobileWorkOrderRequestBody {
  type: CreateWorkOrderData["type"];
  title: string;
  description: string;
  priority?: CreateWorkOrderData["priority"];
  departmentId?: string;
  siteId?: string;
  pelangganId?: string;
  contactName?: string;
  contactPhone?: string;
  locationAddress?: string;
  latitude?: string | number;
  longitude?: string | number;
  notes?: string;
}

export interface MobileWorkOrderRequestSessionUser {
  id: string;
  name?: string | null;
  tenantId?: string | null;
  siteId?: string | null;
  siteIds?: string[];
  isSuperAdmin?: boolean;
}

export class MobileWorkOrderRequestService {
  private readonly prisma: PrismaClient;
  private readonly workOrderRepo: WorkOrderRepository;

  constructor(prismaClient: PrismaClient = prisma) {
    this.prisma = prismaClient;
    this.workOrderRepo = new WorkOrderRepository(prismaClient);
  }

  async createRequest(
    body: MobileWorkOrderRequestBody,
    userSession: MobileWorkOrderRequestSessionUser,
  ) {
    const userId = userSession.id;
    const userName = userSession.name || "Unknown";
    const tenantId = userSession.tenantId as string;

    const departmentId = await this.resolveDepartmentId(
      body.departmentId,
      userId,
      tenantId,
      body.type,
    );

    const pelanggan = body.pelangganId
      ? await this.resolvePelanggan(body.pelangganId, userSession)
      : null;

    const workOrder = await this.workOrderRepo.createRequest({
      type: body.type,
      title: body.title,
      description: body.description,
      priority: body.priority || "NORMAL",
      departmentId,
      ...(body.siteId && { siteId: body.siteId }),
      ...(!body.siteId && userSession.siteId && { siteId: userSession.siteId }),
      ...(pelanggan && {
        pelangganId: pelanggan.id,
        siteId: pelanggan.siteId ?? undefined,
      }),
      contactName: body.contactName || pelanggan?.nama || userName,
      contactPhone: body.contactPhone ?? pelanggan?.noTelp ?? undefined,
      locationAddress: body.locationAddress ?? pelanggan?.alamat ?? undefined,
      ...(body.latitude
        ? { locationLat: parseFloat(String(body.latitude)) }
        : pelanggan?.latitude != null && { locationLat: pelanggan.latitude }),
      ...(body.longitude
        ? { locationLng: parseFloat(String(body.longitude)) }
        : pelanggan?.longitude != null && {
            locationLng: pelanggan.longitude,
          }),
      internalNotes: body.notes,
      requestedById: userId,
      tenantId,
    } as CreateWorkOrderData & { requestedById: string });

    await this.broadcastNewWorkOrder(workOrder, departmentId);
    void this.notifyAdmins(workOrder, userName, tenantId);

    return workOrder;
  }

  private async resolveDepartmentId(
    departmentId: string | undefined,
    userId: string,
    tenantId: string,
    workOrderType?: CreateWorkOrderData["type"],
  ): Promise<string | undefined> {
    if (departmentId) {
      return departmentId;
    }

    // Auto-route specific work order types to appropriate departments
    if (workOrderType) {
      const deptId = await this.getDepartmentByWorkOrderType(
        workOrderType,
        tenantId,
      );
      if (deptId) {
        return deptId;
      }
    }

    const dbUser = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { departmentId: true },
    });

    if (dbUser?.departmentId) {
      return dbUser.departmentId;
    }

    const firstDept = await this.prisma.departments.findFirst({
      where: { tenantId },
      select: { id: true },
    });

    return firstDept?.id;
  }

  /**
   * Map work order type to appropriate department
   */
  private async getDepartmentByWorkOrderType(
    type: CreateWorkOrderData["type"],
    tenantId: string,
  ): Promise<string | undefined> {
    // DISCONNECTION (dismantle) should go to Technical department
    if (type === "DISCONNECTION") {
      const technicalDept = await this.prisma.departments.findFirst({
        where: {
          name: "Technical",
          tenantId,
        },
        select: { id: true },
      });
      return technicalDept?.id;
    }

    // INSTALLATION should also go to Technical department
    if (type === "INSTALLATION") {
      const technicalDept = await this.prisma.departments.findFirst({
        where: {
          name: "Technical",
          tenantId,
        },
        select: { id: true },
      });
      return technicalDept?.id;
    }

    // TROUBLESHOOT, MAINTENANCE, UPGRADE, RELOCATION also go to Technical
    if (
      ["TROUBLESHOOT", "MAINTENANCE", "UPGRADE", "RELOCATION"].includes(type)
    ) {
      const technicalDept = await this.prisma.departments.findFirst({
        where: {
          name: "Technical",
          tenantId,
        },
        select: { id: true },
      });
      return technicalDept?.id;
    }

    return undefined;
  }

  /**
   * Pastikan pelanggan ada dan berada di site karyawan (tenant sudah
   * difilter otomatis oleh ekstensi Prisma). Super admin tidak dibatasi
   * site, mengikuti pola yang sama dengan MobilePelangganService.
   */
  private async resolvePelanggan(
    pelangganId: string,
    user: MobileWorkOrderRequestSessionUser,
  ) {
    const allowedSiteIds = user.siteIds?.length
      ? user.siteIds
      : user.siteId
        ? [user.siteId]
        : [];

    const pelanggan = await this.prisma.pelanggan.findFirst({
      where: {
        id: pelangganId,
        ...(user.isSuperAdmin ? {} : { siteId: { in: allowedSiteIds } }),
      },
      select: {
        id: true,
        nama: true,
        noTelp: true,
        alamat: true,
        latitude: true,
        longitude: true,
        siteId: true,
      },
    });

    if (!pelanggan) {
      throw new Error(
        "FORBIDDEN: Pelanggan tidak ditemukan atau di luar site Anda",
      );
    }
    return pelanggan;
  }

  private async broadcastNewWorkOrder(
    workOrder: Awaited<ReturnType<WorkOrderRepository["createRequest"]>>,
    departmentId?: string,
  ) {
    try {
      const { socketEmitter } = await import("@/lib/websocket/emitter");
      socketEmitter.newWorkOrder(
        {
          id: workOrder.id,
          workOrderNumber: workOrder.workOrderNumber,
          title: workOrder.title,
          type: workOrder.type,
          status: workOrder.status,
          priority: workOrder.priority,
          ...(workOrder.departmentId && {
            departmentId: workOrder.departmentId,
            department: { id: workOrder.departmentId, name: "" },
          }),
          assignedToId: workOrder.assignedToId || null,
          createdAt: workOrder.createdAt.toISOString(),
        },
        departmentId || undefined,
        workOrder.siteId || undefined,
      );
    } catch (error) {
      logger.error("[Mobile WO Request] Socket error:", error);
    }
  }

  private async notifyAdmins(
    workOrder: Awaited<ReturnType<WorkOrderRepository["createRequest"]>>,
    userName: string,
    tenantId: string,
  ) {
    try {
      const adminsWithPermission = await this.prisma.user.findMany({
        where: {
          isActive: true,
          role: {
            permission: {
              some: {
                resource: "workorders",
                action: { in: ["approve_request", "read", "create"] },
                tenantId,
              },
            },
          },
        },
        select: { id: true },
      });

      const adminIds = adminsWithPermission.map((admin) => admin.id);
      if (adminIds.length === 0) {
        return;
      }

      await Promise.all(
        adminIds.map((adminId) =>
          createNotification({
            type: "WORK_ORDER",
            priority: "NORMAL",
            title: "📝 WO Request Baru",
            message: `${userName} mengajukan: ${workOrder.title}`,
            link: `/admin/workorders/list?status=REQUESTED`,
            userId: adminId,
            sourceType: "WORK_ORDER",
            sourceId: workOrder.id,
            skipExpoPush: true,
          }).catch((error) => logger.error("Notification error:", error)),
        ),
      );

      await sendPushToUsers(
        adminIds,
        "📝 WO Request Baru",
        `${userName} mengajukan: ${workOrder.title}`,
        {
          workOrderId: workOrder.id,
          type: "WO_REQUEST",
          screen: "WorkOrderRequests",
        },
      ).catch((error) => logger.error("Push error:", error));
    } catch (error) {
      logger.error("Notify admins error:", error);
    }
  }
}

let mobileWorkOrderRequestServiceInstance: MobileWorkOrderRequestService | null =
  null;

/** Return the shared mobile work-order request service lazily. */
export function getMobileWorkOrderRequestService() {
  mobileWorkOrderRequestServiceInstance ??= new MobileWorkOrderRequestService();
  return mobileWorkOrderRequestServiceInstance;
}
