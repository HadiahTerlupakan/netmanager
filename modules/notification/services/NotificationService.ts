import { NotificationRepository } from "../repositories/NotificationRepository";
import { UserLookupService } from "@/modules/users";
import { Prisma } from "@prisma/client";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import {
  buildCanvasingTitle,
  buildExcludedTypesSqlCondition,
  buildNotificationAccessWhere,
  buildNotificationCreateData,
  buildNotificationMutationPayload,
  buildPointClaimTitle,
  buildSiteSqlCondition,
  buildTenantSqlCondition,
  getMissingTenantId,
  resolveNotificationQueryOptions,
  type NotificationAccessScope,
  type NotificationAccessScopeInput,
} from "./NotificationService.helpers";
import { deliverNotification } from "./NotificationService.delivery";
import {
  findCanvasingVerifiers,
  findEligibleRecipients,
  notifyAssignedWorkOrderRecipients,
  notifyMobileActionRecipients,
  notifyNewCanvasingRecipients,
  notifyNewPointClaimRecipients,
  notifyNewWorkOrderRecipients,
  notifyStatusChangedWorkOrderRecipients,
  notifyUpdatedWorkOrderRecipients,
} from "./NotificationService.workorders";

const notificationRepo = new NotificationRepository();
const userRepo = new UserLookupService();

async function resolveNotificationAccessScope(
  input: NotificationAccessScopeInput,
): Promise<NotificationAccessScope> {
  const user = input.departmentId
    ? null
    : await userRepo.findByIdWithDepartment(input.userId);
  const { tenantId, isSuperAdmin } = await getTenantIdFromContext();
  const effectiveTenantId =
    !isSuperAdmin && !tenantId ? getMissingTenantId() : tenantId;

  return {
    departmentId: input.departmentId || user?.departmentId || undefined,
    tenantCondition: !isSuperAdmin ? { tenantId: effectiveTenantId } : {},
  };
}

export type NotificationType =
  | "WORK_ORDER"
  | "SYSTEM"
  | "TICKET"
  | "ALERT"
  | "ANNOUNCEMENT";
export type NotificationPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export interface CreateNotificationData {
  type: NotificationType;
  priority?: NotificationPriority | undefined;
  title: string;
  message: string;
  link?: string | undefined;
  userId?: string | undefined;
  departmentId?: string | undefined;
  siteId?: string | undefined;
  sourceType?: string | undefined;
  sourceId?: string | undefined;
  skipExpoPush?: boolean | undefined;
  tenantId?: string | undefined;
}

export interface WorkOrderNotificationData {
  workOrderId: string;
  workOrderNumber: string;
  title: string;
  type: string;
  priority: string;
  departmentId?: string | undefined;
  siteId?: string | undefined;
  assignedToId?: string | undefined;
  tenantId?: string | undefined;
}

export async function createNotification(data: CreateNotificationData) {
  const tenantContext = data.tenantId ? null : await getTenantIdFromContext();
  const tenantId = data.tenantId ?? tenantContext?.tenantId ?? null;
  const notification = await notificationRepo.createFull(
    buildNotificationCreateData(data, tenantId),
  );

  await deliverNotification({
    notification,
    data,
    userLookupService: userRepo,
  });

  return notification;
}

export async function notifyNewWorkOrder(
  data: WorkOrderNotificationData & { triggeredByUserId?: string },
) {
  const recipients = await findEligibleRecipients({
    userLookupService: userRepo,
    departmentId: data.departmentId,
    siteId: data.siteId,
    excludeUserId: data.triggeredByUserId,
  });

  return notifyNewWorkOrderRecipients({
    data,
    recipients,
    createNotification,
  });
}

export async function notifyWorkOrderAssigned(
  data: WorkOrderNotificationData & {
    assigneeName?: string;
    triggeredByUserId?: string;
  },
) {
  const observers = await findEligibleRecipients({
    userLookupService: userRepo,
    departmentId: data.departmentId,
    siteId: data.siteId,
    excludeUserId: data.assignedToId,
  });

  await notifyAssignedWorkOrderRecipients({
    data,
    observers,
    createNotification,
  });
}

export async function notifyWorkOrderStatusChange(
  data: WorkOrderNotificationData & {
    oldStatus: string;
    newStatus: string;
    triggeredByUserId?: string;
  },
) {
  const recipients = await findEligibleRecipients({
    userLookupService: userRepo,
    departmentId: data.departmentId,
    siteId: data.siteId,
    excludeUserId: data.triggeredByUserId,
  });

  await notifyStatusChangedWorkOrderRecipients({
    data,
    recipients,
    createNotification,
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
  const recipients = await findEligibleRecipients({
    userLookupService: userRepo,
    departmentId: data.departmentId,
    siteId: data.siteId,
    excludeUserId: data.triggeredByUserId,
  });

  await notifyUpdatedWorkOrderRecipients({
    data,
    recipients,
    createNotification,
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
  const recipients = await findEligibleRecipients({
    userLookupService: userRepo,
    departmentId: data.departmentId,
    siteId: data.siteId,
    excludeUserId: data.triggeredByUserId,
  });

  return notifyMobileActionRecipients({
    data,
    recipients,
    createNotification,
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
  const scope = await resolveNotificationAccessScope({
    userId,
    departmentId: options?.departmentId,
    siteId: options?.siteId,
  });
  const where = buildNotificationAccessWhere(
    {
      userId,
      departmentId: options?.departmentId,
      siteId: options?.siteId,
    },
    scope,
  );

  if (options?.unreadOnly) where.isRead = false;
  if (options?.type) where.type = options.type;
  if (options?.excludeTypes && options.excludeTypes.length > 0) {
    where.type = { notIn: options.excludeTypes };
  }

  const [notifications, total] = await Promise.all([
    notificationRepo.findManyForUser(
      where,
      resolveNotificationQueryOptions(options),
    ),
    notificationRepo.countWhere(where),
  ]);

  return { notifications, total };
}

export async function getReadableNotificationForUser(
  notificationId: string,
  userId: string,
  options?: { departmentId?: string; siteId?: string },
) {
  const scope = await resolveNotificationAccessScope({
    userId,
    departmentId: options?.departmentId,
    siteId: options?.siteId,
  });

  return notificationRepo.findFirst({
    id: notificationId,
    ...buildNotificationAccessWhere(
      {
        userId,
        departmentId: options?.departmentId,
        siteId: options?.siteId,
      },
      scope,
    ),
  });
}

export async function getUnreadCount(
  userId: string,
  excludeTypes?: NotificationType[],
  siteId?: string,
): Promise<number> {
  const { tenantId, isSuperAdmin } = await getTenantIdFromContext();

  return notificationRepo.getUnreadCountRaw(
    userId,
    buildExcludedTypesSqlCondition(excludeTypes),
    buildSiteSqlCondition(siteId),
    buildTenantSqlCondition(isSuperAdmin, tenantId),
  );
}

export async function markAsRead(notificationId: string) {
  return notificationRepo.markAsRead(notificationId);
}

export async function markAllAsRead(
  userId: string,
  type?: NotificationType,
  siteId?: string,
) {
  const scope = await resolveNotificationAccessScope({ userId, siteId });
  const where: Prisma.NotificationsWhereInput = {
    ...buildNotificationAccessWhere({ userId, siteId }, scope),
    isRead: false,
  };

  if (type) {
    where.type = type;
  }

  return notificationRepo.updateMany(where, buildNotificationMutationPayload());
}

export interface CanvasingNotificationData {
  canvasingId: string;
  customerName: string;
  salesId: string;
  salesName?: string;
  siteId?: string | null;
}

export interface PointClaimNotificationData {
  claimId: string;
  canvasingId: string;
  customerName: string;
  salesId: string;
  salesName?: string;
  pointValue: number;
  siteId?: string | null;
}

export async function notifyNewCanvasing(data: CanvasingNotificationData) {
  const recipients = await findCanvasingVerifiers({
    userLookupService: userRepo,
    siteId: data.siteId,
  });

  return notifyNewCanvasingRecipients({
    data,
    recipients,
    createNotification,
    buildCanvasingTitle,
  });
}

export async function notifyNewPointClaim(data: PointClaimNotificationData) {
  const recipients = await findCanvasingVerifiers({
    userLookupService: userRepo,
    siteId: data.siteId,
  });

  return notifyNewPointClaimRecipients({
    data,
    recipients,
    createNotification,
    buildPointClaimTitle,
  });
}
