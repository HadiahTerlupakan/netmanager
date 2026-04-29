import { logger, logActivitySafe } from "@/lib/logger";
import { sendWorkOrderReminder } from "./WorkOrderNotifications";
import { workOrderCacheService } from "./WorkOrderCacheService";
import { AdminWorkOrderRouteRepository } from "../repositories/AdminWorkOrderRouteRepository";
import type { UserContext } from "./WorkOrderService";
import { getWorkOrderService } from "./WorkOrderService";
import { AdminWorkOrderNotificationRouteService } from "./AdminWorkOrderNotificationRouteService";

const WORK_ORDER_REMINDER_STATUSES = [
  "PENDING",
  "ASSIGNED",
  "IN_PROGRESS",
] as const;
const CANCEL_REASON_DEFAULT = "Cancelled by admin";

type PermissionList = string[] | undefined;
type WorkOrderRequestAction = "APPROVE" | "REJECT";

interface WorkOrderApprovalInput {
  workOrderId: string;
  action: WorkOrderRequestAction;
  actor: { id: string; role?: string; name?: string | null };
  permissions?: PermissionList;
  reason?: string;
}

export class AdminWorkOrderActionRouteService {
  private readonly notificationService: AdminWorkOrderNotificationRouteService;

  constructor(
    private readonly repository: AdminWorkOrderRouteRepository,
    private readonly getUserContext: (
      user: { id: string; role?: string; name?: string | null },
      permissions?: PermissionList,
    ) => Promise<UserContext | null>,
  ) {
    this.notificationService = new AdminWorkOrderNotificationRouteService(
      repository,
    );
  }

  private get workOrderService() {
    return getWorkOrderService();
  }

  /** Approve atau reject request work order beserta notifikasi peminta. */
  async processRequestApproval(input: WorkOrderApprovalInput) {
    const userContext = await this.getRequiredUserContext(
      input.actor,
      input.permissions,
    );
    if (!userContext) return { success: false as const, code: "UNAUTHORIZED" };
    const workOrderResult = await this.workOrderService.getWorkOrderById(
      input.workOrderId,
      userContext,
    );
    if (!workOrderResult.success || !workOrderResult.data) {
      return {
        success: false as const,
        code: workOrderResult.code || "NOT_FOUND",
        error: workOrderResult.error,
      };
    }
    const actionResult = await this.executeRequestApprovalAction({
      action: input.action,
      workOrderId: input.workOrderId,
      userContext,
      reason: input.reason,
    });
    if (!actionResult.success) return actionResult;
    await this.notificationService.notifyRequesterOfApprovalResult({
      requesterId: workOrderResult.data.requestedById,
      action: input.action,
      title: workOrderResult.data.title,
      workOrderId: input.workOrderId,
      reason: input.reason,
    });
    return actionResult;
  }

  /** Tambahkan komentar WO dan kirim notifikasi side effect. */
  async addComment(input: {
    workOrderId: string;
    message: string;
    actor: { id: string; name?: string | null; role?: string };
    permissions?: PermissionList;
  }) {
    const userContext = await this.getRequiredUserContext(
      input.actor,
      input.permissions,
    );
    if (!userContext) return { success: false as const, code: "UNAUTHORIZED" };
    const result = await this.workOrderService.addComment(
      input.workOrderId,
      input.message,
      userContext,
    );
    if (!result.success) return result;
    await this.logCommentCreated(input, (result.data as { id: string }).id);
    await this.notificationService.notifyWorkOrderUpdate({
      workOrderId: input.workOrderId,
      message: `${input.actor.name || "Admin"}: ${this.notificationService.truncateActivityMessage(input.message)}`,
      actorName: input.actor.name || "Admin",
      actorId: input.actor.id,
    });
    return result;
  }

  /** Tambahkan task WO dan jalankan side effect notifikasi. */
  async addTask(input: {
    workOrderId: string;
    title: string;
    description?: string;
    order?: number;
    actor: { id: string; name?: string | null; role?: string };
    permissions?: PermissionList;
  }) {
    const userContext = await this.getRequiredUserContext(
      input.actor,
      input.permissions,
    );
    if (!userContext) return { success: false as const, code: "UNAUTHORIZED" };
    const result = await this.workOrderService.addTask(
      input.workOrderId,
      {
        title: input.title,
        description: input.description,
        order: input.order,
      },
      userContext,
    );
    if (!result.success) return result;
    await this.logTaskCreated(
      input,
      result.data as { id: string; title: string; order: number },
    );
    await this.notificationService.notifyWorkOrderUpdate({
      workOrderId: input.workOrderId,
      message: `Admin menambahkan tugas: "${input.title}"`,
      actorName: input.actor.name || "Admin",
      actorId: input.actor.id,
    });
    return result;
  }

  /** Tambahkan material dengan resolusi gudang default user bila perlu. */
  async addMaterial(input: {
    workOrderId: string;
    barangId: string;
    quantity: number;
    notes?: string;
    gudangId?: string;
    actor: { id: string; role?: string; name?: string | null };
    permissions?: PermissionList;
  }) {
    const userContext = await this.getRequiredUserContext(
      input.actor,
      input.permissions,
    );
    if (!userContext) return { success: false as const, code: "UNAUTHORIZED" };
    const gudangId = await this.resolveGudangId(
      input.gudangId,
      userContext.siteId,
    );
    return this.workOrderService.addMaterial(
      input.workOrderId,
      input.barangId,
      input.quantity,
      userContext,
      input.notes,
      gudangId,
    );
  }

  /** Kirim reminder manual untuk work order aktif. */
  async sendReminder(input: {
    workOrderId: string;
    customMessage?: string;
    targetDepartmentId?: string;
  }) {
    const workOrder = await this.repository.findReminderWorkOrderById(
      input.workOrderId,
    );
    if (!workOrder) return { success: false as const, code: "NOT_FOUND" };
    if (!this.canSendReminder(workOrder.status)) {
      return { success: false as const, code: "INVALID_STATUS" };
    }
    const sentCount = await sendWorkOrderReminder(
      {
        id: workOrder.id,
        workOrderNumber: workOrder.workOrderNumber,
        title: workOrder.title,
        type: workOrder.type,
        priority: workOrder.priority,
        departmentId: input.targetDepartmentId || workOrder.departmentId,
        siteId: workOrder.siteId,
        assignedToId: workOrder.assignedToId,
      },
      input.customMessage,
    );
    return { success: true as const, data: { sentCount } };
  }

  /** Hapus permanen atau cancel work order dengan side effect terkait. */
  async deleteWorkOrder(input: {
    workOrderId: string;
    permanent?: boolean;
    reason?: string;
    actor: { id: string; role?: string; name?: string | null };
    permissions?: PermissionList;
  }) {
    const userContext = await this.getRequiredUserContext(
      input.actor,
      input.permissions,
    );
    if (!userContext) return { success: false as const, code: "UNAUTHORIZED" };
    if (input.permanent)
      return this.deleteWorkOrderPermanently(input.workOrderId, userContext);
    return this.cancelWorkOrder(input, userContext);
  }

  private getRequiredUserContext(
    user: { id: string; role?: string; name?: string | null },
    permissions?: PermissionList,
  ) {
    return this.getUserContext(user, permissions);
  }

  private executeRequestApprovalAction(input: {
    workOrderId: string;
    action: WorkOrderRequestAction;
    userContext: UserContext;
    reason?: string;
  }) {
    if (input.action === "APPROVE") {
      return this.workOrderService.approveRequest(
        input.workOrderId,
        input.userContext,
      );
    }
    return this.workOrderService.rejectRequest(
      input.workOrderId,
      input.userContext,
      input.reason || "",
    );
  }

  private logCommentCreated(
    input: { workOrderId: string; message: string; actor: { id: string } },
    commentId: string,
  ) {
    return logger.logActivity({
      action: "CREATE",
      subject: "Work Order Comment",
      details: {
        workOrderId: input.workOrderId,
        commentId,
        message: this.notificationService.truncateActivityMessage(
          input.message,
        ),
      },
      userId: input.actor.id,
    });
  }

  private logTaskCreated(
    input: { workOrderId: string; actor: { id: string } },
    task: { id: string; title: string; order: number },
  ) {
    return logger.logActivity({
      action: "CREATE",
      subject: "Work Order Task",
      details: {
        workOrderId: input.workOrderId,
        taskId: task.id,
        taskTitle: task.title,
        order: task.order,
      },
      userId: input.actor.id,
    });
  }

  private async resolveGudangId(
    gudangId: string | undefined,
    siteId: string | undefined,
  ) {
    if (gudangId || !siteId) return gudangId;
    return this.repository.findFirstGudangBySite(siteId);
  }

  private canSendReminder(status: string) {
    return (WORK_ORDER_REMINDER_STATUSES as readonly string[]).includes(status);
  }

  private async deleteWorkOrderPermanently(
    workOrderId: string,
    userContext: UserContext,
  ) {
    await this.repository.resetCanvasingByWorkOrderId(workOrderId);
    return this.workOrderService.deleteWorkOrder(workOrderId, userContext);
  }

  private async cancelWorkOrder(
    input: {
      workOrderId: string;
      reason?: string;
      actor: { id: string };
    },
    userContext: UserContext,
  ) {
    const reason = input.reason || CANCEL_REASON_DEFAULT;
    const result = await this.workOrderService.updateStatus(
      input.workOrderId,
      "CANCELLED",
      userContext,
      reason,
    );
    if (!result.success) return result;
    logActivitySafe({
      action: "DELETE",
      subject: "Work Order",
      userId: input.actor.id,
      details: { id: input.workOrderId, reason, type: "CANCEL" },
    });
    await workOrderCacheService.invalidateAllCaches();
    return result;
  }
}
