import { UserLookupService } from "@/modules/users/api";
import { NotificationRepository } from "../repositories/NotificationRepository";
import {
  getNotificationsForUserAccess,
  getReadableNotificationForUserAccess,
  getUnreadCountAccess,
  markAllAsReadAccess,
} from "./NotificationService.access";
import type { NotificationType } from "./NotificationService.types";

function getNotificationRepository() {
  return new NotificationRepository();
}

function getUserLookupService() {
  return new UserLookupService();
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
    includeTotal?: boolean;
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
  departmentId?: string,
): Promise<number> {
  return getUnreadCountAccess({
    repository: getNotificationRepository(),
    userId,
    excludeTypes,
    siteId,
    departmentId,
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

export type { NotificationType } from "./NotificationService.types";
