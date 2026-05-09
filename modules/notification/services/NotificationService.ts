import { NotificationRepository } from "../repositories/NotificationRepository";
import { UserLookupService } from "@/modules/users";
import { deliverNotification } from "./NotificationService.delivery";
import { buildNotificationCreateData } from "./NotificationService.helpers";
import {
  notifyNewCanvasingRecipients,
  notifyNewPointClaimRecipients,
} from "./NotificationService.marketing";
import {
  buildHolidayNotificationLink,
  buildHolidayNotificationMessage,
  buildHolidayNotificationTitle,
  type HolidayNotificationData,
} from "./NotificationService.holiday";
import { findCanvasingVerifiers } from "./NotificationService.recipients";
import type {
  CanvasingNotificationData,
  CreateNotificationData,
  NotificationType,
  PointClaimNotificationData,
  WorkOrderNotificationData,
} from "./NotificationService.types";
import {
  notifyAdminsAboutMobileActionEvent,
  notifyNewWorkOrderEvent,
  notifyWorkOrderAssignedEvent,
  notifyWorkOrderStatusChangeEvent,
  notifyWorkOrderUpdateEvent,
} from "./NotificationService.work-order-events";
import {
  getNotificationsForUserAccess,
  getReadableNotificationForUserAccess,
  getUnreadCountAccess,
  markAllAsReadAccess,
} from "./NotificationService.access";
import { getTenantIdFromContext } from "@/lib/tenant-context";

function getNotificationRepository() {
  return new NotificationRepository();
}

function getUserLookupService() {
  return new UserLookupService();
}

export async function createNotification(data: CreateNotificationData) {
  const tenantContext = data.tenantId ? null : await getTenantIdFromContext();
  const tenantId = data.tenantId ?? tenantContext?.tenantId ?? null;
  const notification = await getNotificationRepository().createFull(
    buildNotificationCreateData(data, tenantId),
  );

  await deliverNotification({
    notification,
    data,
    userLookupService: getUserLookupService(),
  });

  return notification;
}

export async function notifyNewWorkOrder(
  data: WorkOrderNotificationData & { triggeredByUserId?: string },
) {
  return notifyNewWorkOrderEvent({
    data,
    createNotification,
    userLookupService: getUserLookupService(),
  });
}

export async function notifyWorkOrderAssigned(
  data: WorkOrderNotificationData & {
    assigneeName?: string;
    triggeredByUserId?: string;
  },
) {
  await notifyWorkOrderAssignedEvent({
    data,
    createNotification,
    userLookupService: getUserLookupService(),
  });
}

export async function notifyWorkOrderStatusChange(
  data: WorkOrderNotificationData & {
    oldStatus: string;
    newStatus: string;
    triggeredByUserId?: string;
  },
) {
  await notifyWorkOrderStatusChangeEvent({
    data,
    createNotification,
    userLookupService: getUserLookupService(),
  });
}

export async function notifyWorkOrderUpdate(
  data: WorkOrderNotificationData & {
    updateMessage: string;
    updatedByName?: string;
    triggeredByUserId?: string;
    excludeUserIds?: string[];
  },
) {
  await notifyWorkOrderUpdateEvent({
    data,
    createNotification,
    userLookupService: getUserLookupService(),
  });
}

export async function notifyAdminsAboutMobileAction(data: {
  workOrderId: string;
  workOrderNumber: string;
  title: string;
  actionType: string;
  actionMessage: string;
  triggeredByUserId: string;
  triggeredByName?: string;
  departmentId?: string;
  siteId?: string;
}) {
  return notifyAdminsAboutMobileActionEvent({
    data,
    createNotification,
    userLookupService: getUserLookupService(),
  });
}

export async function getNotificationsForUser(
  userId: string,
  options?: {
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
    type?: NotificationType;
    excludeTypes?: NotificationType[];
    siteId?: string;
    departmentId?: string;
  },
) {
  return getNotificationsForUserAccess({
    repository: getNotificationRepository(),
    userLookupService: getUserLookupService(),
    userId,
    options,
  });
}

export async function getReadableNotificationForUser(
  notificationId: string,
  userId: string,
  options?: { departmentId?: string; siteId?: string },
) {
  return getReadableNotificationForUserAccess({
    repository: getNotificationRepository(),
    userLookupService: getUserLookupService(),
    notificationId,
    userId,
    options,
  });
}

export async function getUnreadCount(
  userId: string,
  excludeTypes?: NotificationType[],
  siteId?: string,
): Promise<number> {
  return getUnreadCountAccess({
    repository: getNotificationRepository(),
    userId,
    excludeTypes,
    siteId,
  });
}

export async function markAsRead(notificationId: string) {
  return getNotificationRepository().markAsRead(notificationId);
}

export async function markAllAsRead(
  userId: string,
  type?: NotificationType,
  siteId?: string,
) {
  return markAllAsReadAccess({
    repository: getNotificationRepository(),
    userLookupService: getUserLookupService(),
    userId,
    type,
    siteId,
  });
}

export async function notifyNewCanvasing(data: CanvasingNotificationData) {
  const recipients = await findCanvasingVerifiers({
    userLookupService: getUserLookupService(),
    siteId: data.siteId,
  });

  return notifyNewCanvasingRecipients({
    data,
    recipients,
    createNotification,
  });
}

export async function notifyNewPointClaim(data: PointClaimNotificationData) {
  const recipients = await findCanvasingVerifiers({
    userLookupService: getUserLookupService(),
    siteId: data.siteId,
  });

  return notifyNewPointClaimRecipients({
    data,
    recipients,
    createNotification,
  });
}

export async function notifyHolidayCreated(
  data: HolidayNotificationData,
): Promise<void> {
  const userLookupService = getUserLookupService();

  const activeUsers = await userLookupService.findAllActiveInTenant(
    data.tenantId,
  );

  const title = buildHolidayNotificationTitle();
  const message = buildHolidayNotificationMessage(
    data.holidayName,
    data.holidayDate,
    data.description,
  );
  const link = buildHolidayNotificationLink();

  const notifications = activeUsers.map((user) =>
    createNotification({
      type: "HOLIDAY_CREATED",
      priority: "NORMAL",
      title,
      message,
      link,
      userId: user.id,
      sourceType: "Holiday",
      sourceId: data.holidayId,
      tenantId: data.tenantId,
    }),
  );

  await Promise.all(notifications);
}

export type {
  CanvasingNotificationData,
  CreateNotificationData,
  NotificationPriority,
  NotificationType,
  PointClaimNotificationData,
  WorkOrderNotificationData,
} from "./NotificationService.types";
export type { HolidayNotificationData } from "./NotificationService.holiday";
