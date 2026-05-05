/**
 * NOTE: Prisma import is intentionally kept here for type safety and SQL building.
 * This helper uses:
 * - Prisma.NotificationsWhereInput for dynamic query building with type safety
 * - Prisma.sql and Prisma.join for raw SQL query construction
 * - Prisma.empty for conditional SQL fragments
 * Removing this would require duplicating all Prisma types or losing type safety.
 * This is a valid use case and does not violate Clean Architecture principles.
 */
import { Prisma } from "@prisma/client";

import {
  getActionEmoji,
  getPriorityEmoji,
  getStatusEmoji,
  getWorkOrderTypeLabel,
} from "../utils/constants";
import type {
  CreateNotificationData,
  NotificationType,
} from "./NotificationService.types";

export type RecipientUser = { id: string };

export type EligibleUser = {
  id: string;
  name: string | null;
  departmentId: string | null;
  siteId: string | null;
  userSites: Array<{ siteId: string }>;
  role: {
    name: string;
    permission: Array<{ id: string }>;
  } | null;
};

export type NotificationAccessScopeInput = {
  userId: string;
  departmentId?: string;
  siteId?: string;
};

export type NotificationAccessScope = {
  departmentId?: string;
  tenantCondition: Prisma.NotificationsWhereInput;
};

const MISSING_TENANT_ID = "___MISSING_TENANT_ID___";
const FALLBACK_DEPARTMENT_ID = "NONE";
const DEFAULT_NOTIFICATION_LIMIT = 50;
const DEFAULT_NOTIFICATION_OFFSET = 0;

/** Build notification access where clause for one user scope. */
export function buildNotificationAccessWhere(
  input: NotificationAccessScopeInput,
  scope: NotificationAccessScope,
): Prisma.NotificationsWhereInput {
  return {
    ...scope.tenantCondition,
    OR: [
      { userId: input.userId },
      {
        AND: [
          { departmentId: scope.departmentId || FALLBACK_DEPARTMENT_ID },
          ...(input.siteId
            ? [{ OR: [{ siteId: input.siteId }, { siteId: null }] }]
            : []),
        ],
      },
    ],
  };
}

/** Resolve list pagination defaults for notification queries. */
export function resolveNotificationQueryOptions(options?: {
  limit?: number;
  offset?: number;
}) {
  return {
    take: options?.limit || DEFAULT_NOTIFICATION_LIMIT,
    skip: options?.offset || DEFAULT_NOTIFICATION_OFFSET,
  };
}

/** Build tenant SQL filter for raw unread count query. */
export function buildTenantSqlCondition(
  isSuperAdmin: boolean,
  tenantId?: string | null,
) {
  if (isSuperAdmin) {
    return Prisma.empty;
  }

  return Prisma.sql`AND n."tenantId" = ${tenantId || MISSING_TENANT_ID}`;
}

/** Build excluded type SQL filter for raw unread count query. */
export function buildExcludedTypesSqlCondition(
  excludeTypes?: NotificationType[],
) {
  return excludeTypes && excludeTypes.length > 0
    ? Prisma.sql`AND "type" NOT IN (${Prisma.join(excludeTypes)})`
    : Prisma.empty;
}

/** Build site SQL filter for raw unread count query. */
export function buildSiteSqlCondition(siteId?: string) {
  return siteId
    ? Prisma.sql`AND ("siteId" = ${siteId} OR "siteId" IS NULL)`
    : Prisma.empty;
}

/** Build payload for mark-as-read mutations. */
export function buildNotificationMutationPayload() {
  return {
    isRead: true,
    readAt: new Date(),
  };
}

/** Decide whether notification should also reach admins. */
export function shouldNotifyAdmins(data: CreateNotificationData) {
  return (
    data.priority === "HIGH" ||
    data.priority === "URGENT" ||
    data.type === "ALERT"
  );
}

/** Build push metadata attached to notification pushes. */
export function buildNotificationPushMetadata(
  notificationId: string,
  data: Pick<CreateNotificationData, "link" | "sourceType" | "sourceId">,
) {
  return {
    notificationId,
    url: data.link || "/employee/notifications",
    sourceType: data.sourceType || "",
    sourceId: data.sourceId || "",
  };
}

/** Build websocket payload from a created notification record. */
export function buildWebsocketPayload(notification: {
  id: string;
  type: string;
  priority: string;
  title: string;
  message: string;
  link: string | null;
  createdAt: Date;
}) {
  return {
    id: notification.id,
    type: notification.type,
    priority: notification.priority,
    title: notification.title,
    message: notification.message,
    link: notification.link || undefined,
    createdAt: notification.createdAt.toISOString(),
  };
}

/** Build repository payload for notification creation. */
export function buildNotificationCreateData(
  data: CreateNotificationData,
  tenantId: string | null,
) {
  return {
    id: crypto.randomUUID(),
    type: data.type,
    priority: data.priority || "NORMAL",
    title: data.title,
    message: data.message,
    link: data.link || null,
    userId: data.userId || null,
    departmentId: data.departmentId || null,
    siteId: data.siteId || null,
    sourceType: data.sourceType || null,
    sourceId: data.sourceId || null,
    tenantId,
  };
}

/** Keep admin site routing consistent with current behavior. */
export function buildAdminNotificationSiteId(siteId?: string) {
  return siteId;
}

/** Build title for new work order notifications. */
export function buildAssigneeTitle(
  isAssignee: boolean,
  priorityEmoji: string,
  workOrderNumber: string,
) {
  return isAssignee
    ? `📋 Work Order Di-assign ke Anda`
    : `${priorityEmoji} Work Order Baru: ${workOrderNumber}`;
}

/** Build title for work order status change notifications. */
export function buildStatusChangeTitle(
  isAssignee: boolean,
  statusEmoji: string,
) {
  return isAssignee
    ? `${statusEmoji} Status WO Anda Berubah`
    : `${statusEmoji} Status WO Berubah`;
}

/** Build title for work order assignment observer notification. */
export function buildAssignmentObserverTitle() {
  return `👤 Work Order Ditugaskan`;
}

/** Build title for work order update notification. */
export function buildWorkOrderUpdateTitle(workOrderNumber: string) {
  return `💬 Update pada ${workOrderNumber}`;
}

/** Build title for canvasing notification. */
export function buildCanvasingTitle() {
  return "📋 Canvasing Baru";
}

/** Build title for point claim notification. */
export function buildPointClaimTitle() {
  return "🎁 Claim Poin Baru";
}

/** Build message for new work order notification. */
export function buildNewWorkOrderMessage(type: string, title: string) {
  return `[${getWorkOrderTypeLabel(type)}] ${title}`;
}

/** Build status change message for one work order. */
export function buildStatusChangeMessage(
  workOrderNumber: string,
  oldStatus: string,
  newStatus: string,
) {
  return `${workOrderNumber}: ${oldStatus} → ${newStatus}`;
}

/** Resolve work order priority emoji. */
export function resolvePriorityEmoji(priority: string) {
  return getPriorityEmoji(priority);
}

/** Resolve work order status emoji. */
export function resolveStatusEmoji(status: string) {
  return getStatusEmoji(status);
}

/** Resolve mobile action emoji. */
export function resolveActionEmoji(actionType: string) {
  return getActionEmoji(actionType);
}

/** Expose missing tenant identifier for scope building. */
export function getMissingTenantId() {
  return MISSING_TENANT_ID;
}
