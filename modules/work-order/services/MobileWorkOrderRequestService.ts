import { PrismaClient } from "@prisma/client";
import { prisma } from "@/modules/database";
import { createNotification, sendPushToUsers } from "@/modules/notification";
import { WorkOrderRepository } from "../repositories/WorkOrderRepository";
import type { CreateWorkOrderData } from "../repositories/IWorkOrderRepository";

export interface MobileWorkOrderRequestBody {
  type: CreateWorkOrderData["type"];
  title: string;
  description: string;
  priority?: CreateWorkOrderData["priority"];
  departmentId?: string;
  siteId?: string;
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
    );

    const workOrder = await this.workOrderRepo.createRequest({
      type: body.type,
      title: body.title,
      description: body.description,
      priority: body.priority || "NORMAL",
      departmentId,
      ...(body.siteId && { siteId: body.siteId }),
      ...(!body.siteId && userSession.siteId && { siteId: userSession.siteId }),
      contactName: body.contactName || userName,
      contactPhone: body.contactPhone,
      locationAddress: body.locationAddress,
      ...(body.latitude && { locationLat: parseFloat(String(body.latitude)) }),
      ...(body.longitude && {
        locationLng: parseFloat(String(body.longitude)),
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
  ): Promise<string | undefined> {
    if (departmentId) {
      return departmentId;
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
      console.error("[Mobile WO Request] Socket error:", error);
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
          }).catch((error) => console.error("Notification error:", error)),
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
      ).catch((error) => console.error("Push error:", error));
    } catch (error) {
      console.error("Notify admins error:", error);
    }
  }
}

export const mobileWorkOrderRequestService =
  new MobileWorkOrderRequestService();
