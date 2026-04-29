import { createNotification, sendPushToUsers } from "@/modules/notification";
import { onWorkOrderUpdated } from "./WorkOrderNotifications";
import { AdminWorkOrderRouteRepository } from "../repositories/AdminWorkOrderRouteRepository";

const ACTIVITY_MESSAGE_LIMIT = 100;

type WorkOrderRequestAction = "APPROVE" | "REJECT";

export class AdminWorkOrderNotificationRouteService {
  constructor(private readonly repository: AdminWorkOrderRouteRepository) {}

  /** Kirim notifikasi hasil approval/rejection ke requester. */
  async notifyRequesterOfApprovalResult(input: {
    requesterId?: string | null;
    action: WorkOrderRequestAction;
    title: string;
    workOrderId: string;
    reason?: string;
  }) {
    if (!input.requesterId) return;
    const notification = this.getApprovalNotification(input);
    try {
      await createNotification({
        type: "WORK_ORDER",
        priority: input.action === "REJECT" ? "HIGH" : "NORMAL",
        title: notification.title,
        message: notification.message,
        link: `/admin/workorders/${input.workOrderId}`,
        userId: input.requesterId,
        sourceType: "WORK_ORDER",
        sourceId: input.workOrderId,
      });
      await sendPushToUsers(
        [input.requesterId],
        notification.title,
        notification.message,
        {
          workOrderId: input.workOrderId,
          type: "WO_REQUEST_RESULT",
          action: input.action,
          screen: "WorkOrderDetail",
        },
      );
    } catch {
      return;
    }
  }

  /** Kirim notifikasi update work order ke assignee aktif. */
  async notifyWorkOrderUpdate(input: {
    workOrderId: string;
    message: string;
    actorName: string;
    actorId: string;
  }) {
    const workOrder = await this.repository.findWorkOrderNotificationPayload(
      input.workOrderId,
    );
    if (!workOrder?.assignedTo?.isActive) return;
    const isOnLeave = await this.repository.isUserOnApprovedLeave(
      workOrder.assignedTo.id,
    );
    await createNotification({
      type: "WORK_ORDER",
      priority: "NORMAL",
      title: `Update Work Order: ${workOrder.workOrderNumber}`,
      message: input.message,
      link: `/admin/workorders/${input.workOrderId}`,
      userId: workOrder.assignedTo.id,
      sourceType: "WORK_ORDER",
      sourceId: input.workOrderId,
      skipExpoPush: isOnLeave,
    });
    await onWorkOrderUpdated(
      {
        id: workOrder.id,
        workOrderNumber: workOrder.workOrderNumber,
        title: workOrder.title,
        type: workOrder.type,
        priority: workOrder.priority,
        departmentId: workOrder.departmentId,
        siteId: workOrder.siteId,
        assignedToId: workOrder.assignedToId,
      },
      input.message,
      input.actorName,
      input.actorId,
      [workOrder.assignedTo.id],
    );
  }

  /** Potong pesan activity agar konsisten dengan route admin. */
  truncateActivityMessage(message: string) {
    return message.substring(0, ACTIVITY_MESSAGE_LIMIT);
  }

  private getApprovalNotification(input: {
    action: WorkOrderRequestAction;
    title: string;
    reason?: string;
  }) {
    if (input.action === "APPROVE") {
      return {
        title: "WO Request Disetujui",
        message: `Request Anda "${input.title}" telah disetujui and siap dikerjakan.`,
      };
    }
    return {
      title: "WO Request Ditolak",
      message: `Request Anda "${input.title}" ditolak: ${input.reason}`,
    };
  }
}
