import {
  buildAssigneeTitle,
  buildAssignmentObserverTitle,
  buildNewWorkOrderMessage,
  buildStatusChangeMessage,
  buildStatusChangeTitle,
  buildWorkOrderUpdateTitle,
  type RecipientUser,
} from "./NotificationService.helpers";
import type {
  CreateNotificationData,
  NotificationPriority,
  WorkOrderNotificationData,
} from "./NotificationService.types";

/** Bangun payload notification untuk work-order baru. */
export function buildNewWorkOrderNotification(
  recipient: RecipientUser,
  data: WorkOrderNotificationData,
  priorityEmoji: string,
): CreateNotificationData {
  return {
    type: "WORK_ORDER",
    priority: data.priority as NotificationPriority,
    title: buildAssigneeTitle(
      recipient.id === data.assignedToId,
      priorityEmoji,
      data.workOrderNumber,
    ),
    message: buildNewWorkOrderMessage(data.type, data.title),
    link: `/admin/workorders/${data.workOrderId}`,
    userId: recipient.id,
    siteId: data.siteId,
    sourceType: "WORK_ORDER",
    sourceId: data.workOrderId,
  };
}

/** Bangun payload notification untuk observer assignment work-order. */
export function buildWorkOrderAssignmentObserverNotification(
  recipient: RecipientUser,
  data: WorkOrderNotificationData & { assigneeName?: string },
): CreateNotificationData {
  return {
    type: "WORK_ORDER",
    priority: "NORMAL",
    title: buildAssignmentObserverTitle(),
    message: `${data.workOrderNumber} ditugaskan kepada ${data.assigneeName || "user"}`,
    link: `/admin/workorders/${data.workOrderId}`,
    userId: recipient.id,
    siteId: data.siteId,
    sourceType: "WORK_ORDER",
    sourceId: data.workOrderId,
  };
}

/** Bangun payload notification untuk perubahan status work-order. */
export function buildStatusChangedNotification(
  recipient: RecipientUser,
  data: WorkOrderNotificationData & { oldStatus: string; newStatus: string },
  statusEmoji: string,
): CreateNotificationData {
  return {
    type: "WORK_ORDER",
    priority: "NORMAL",
    title: buildStatusChangeTitle(
      recipient.id === data.assignedToId,
      statusEmoji,
    ),
    message: buildStatusChangeMessage(
      data.workOrderNumber,
      data.oldStatus,
      data.newStatus,
    ),
    link: `/admin/workorders/${data.workOrderId}`,
    userId: recipient.id,
    siteId: data.siteId,
    sourceType: "WORK_ORDER",
    sourceId: data.workOrderId,
  };
}

/** Bangun payload notification untuk update work-order. */
export function buildWorkOrderUpdateNotification(
  recipient: RecipientUser,
  data: WorkOrderNotificationData & { updateMessage: string },
): CreateNotificationData {
  return {
    type: "WORK_ORDER",
    priority: "NORMAL",
    title: buildWorkOrderUpdateTitle(data.workOrderNumber),
    message: data.updateMessage,
    link: `/admin/workorders/${data.workOrderId}`,
    userId: recipient.id,
    siteId: data.siteId,
    sourceType: "WORK_ORDER",
    sourceId: data.workOrderId,
  };
}
