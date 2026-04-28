import { logger } from "@/lib/logger";
import {
  sendPushNotification as sendExpoPush,
  sendPushToDepartment as sendExpoPushToDepartment,
} from "./ExpoPushService";
import { NotificationRepository } from "../repositories/NotificationRepository";
import { UserRepository } from "@/modules/users/repositories/UserRepository";
import { Prisma } from "@prisma/client";
import { socketEmitter } from "@/lib/websocket/emitter";
import { getAdminTokens, sendFCMNotification } from "@/lib/firebase/messaging";
import {
  getPriorityEmoji,
  getStatusEmoji,
  getActionEmoji,
  getWorkOrderTypeLabel,
} from "../utils/constants";
import { getTenantIdFromContext } from "@/lib/tenant-context";

type RecipientUser = { id: string };
type EligibleUser = {
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

const notificationRepo = new NotificationRepository();
const userRepo = new UserRepository();

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

  const notification = await notificationRepo.createFull({
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
  });

  const wsPayload = {
    id: notification.id,
    type: notification.type,
    priority: notification.priority,
    title: notification.title,
    message: notification.message,
    link: notification.link || undefined,
    createdAt: notification.createdAt.toISOString(),
  };

  if (data.userId) {
    socketEmitter.notifyUser(data.userId, wsPayload);

    const directRecipient = await userRepo.findByIdWithPushToken(data.userId);
    if (directRecipient?.fcmTokens?.length) {
      sendFCMNotification(directRecipient.fcmTokens, data.title, data.message, {
        notificationId: notification.id,
        url: data.link || "/employee/notifications",
        sourceType: data.sourceType || "",
        sourceId: data.sourceId || "",
      }).catch((err) => logger.error("[FCM Push] Error:", err));
    }

    if (!data.skipExpoPush) {
      sendExpoPush(data.userId, data.title, data.message, {
        link: data.link || undefined,
        sourceType: data.sourceType || undefined,
        sourceId: data.sourceId || undefined,
      }).catch((err) => logger.error("[Expo Push] Error:", err));
    }
  }

  if (data.departmentId) {
    socketEmitter.notifyDepartment(data.departmentId, wsPayload);
    const departmentRecipients =
      await userRepo.findManyActiveWithPushTokenAndSite(
        data.departmentId,
        data.siteId,
      );
    const departmentFcmTokens = departmentRecipients.flatMap(
      (recipient) => recipient.fcmTokens ?? [],
    );

    if (departmentFcmTokens.length > 0) {
      sendFCMNotification(departmentFcmTokens, data.title, data.message, {
        notificationId: notification.id,
        url: data.link || "/employee/notifications",
        sourceType: data.sourceType || "",
        sourceId: data.sourceId || "",
      }).catch((err) => logger.error("[FCM Push Dept] Error:", err));
    }

    if (!data.skipExpoPush) {
      sendExpoPushToDepartment(data.departmentId, data.title, data.message, {
        link: data.link || undefined,
        sourceType: data.sourceType || undefined,
        sourceId: data.sourceId || undefined,
      }).catch((err) => logger.error("[Expo Push Dept] Error:", err));
    }
  }

  if (
    data.priority === "HIGH" ||
    data.priority === "URGENT" ||
    data.type === "ALERT"
  ) {
    socketEmitter.notifyAdmins(wsPayload, data.siteId);

    const adminTokens = await getAdminTokens();
    if (adminTokens.length > 0) {
      sendFCMNotification(adminTokens, data.title, data.message, {
        notificationId: notification.id,
        url: data.link || "/employee/notifications",
        sourceType: data.sourceType || "",
        sourceId: data.sourceId || "",
      }).catch((err) => logger.error("[FCM Push Admin] Error:", err));
    }
  }

  return notification;
}

async function findEligibleRecipients(
  departmentId?: string,
  siteId?: string,
  excludeUserId?: string,
): Promise<RecipientUser[]> {
  if (!excludeUserId) {
    logger.warn(
      `[NotificationDebug] WARNING: findEligibleRecipients called without excludeUserId.`,
    );
  }

  const whereClause: Prisma.UserWhereInput = {
    isActive: true,
    ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    role: { permission: { some: { resource: "workorders", action: "read" } } },
  };

  if (siteId) {
    whereClause.OR = [
      { siteId: siteId },
      { siteId: null },
      { userSites: { some: { siteId: siteId } } },
    ];
  }

  if (departmentId) {
    whereClause.OR = whereClause.OR
      ? whereClause.OR.map((condition: Prisma.UserWhereInput) => ({
          ...condition,
          OR: [
            { departmentId: departmentId },
            { departmentId: null },
            {
              role: {
                permission: {
                  none: { resource: "workorders", action: "department_only" },
                },
              },
            },
          ],
        }))
      : [
          { departmentId: departmentId },
          { departmentId: null },
          {
            role: {
              permission: {
                none: { resource: "workorders", action: "department_only" },
              },
            },
          },
        ];
  }

  const usersWithPermission =
    await userRepo.findManyWithDetailedRelations(whereClause);

  const eligibleUsers = usersWithPermission.filter((user: EligibleUser) => {
    if (excludeUserId && user.id === excludeUserId) return false;
    const hasSiteOnly =
      user.role?.permission && user.role.permission.length > 0;
    if (!hasSiteOnly) return true;
    if (!siteId) return true;
    const userSiteIds =
      user.userSites?.map((us: { siteId: string }) => us.siteId) || [];
    return (
      userSiteIds.includes(siteId) ||
      user.siteId === siteId ||
      user.siteId === null
    );
  });

  return eligibleUsers.map((u: { id: string }) => ({ id: u.id }));
}

export async function notifyNewWorkOrder(
  data: WorkOrderNotificationData & { triggeredByUserId?: string },
) {
  const priorityEmoji = getPriorityEmoji(data.priority);
  const typeLabel = getWorkOrderTypeLabel(data.type);
  const recipients = await findEligibleRecipients(
    data.departmentId,
    data.siteId,
    data.triggeredByUserId,
  );

  if (recipients.length === 0) {
    logger.warn(
      `[NotificationDebug] NO RECIPIENTS FOUND for New WO ${data.workOrderNumber}.`,
    );
    return null;
  }

  await Promise.all(
    recipients.map(async (user: RecipientUser) => {
      const isAssignee = user.id === data.assignedToId;
      await createNotification({
        type: "WORK_ORDER",
        priority: data.priority as NotificationPriority,
        title: isAssignee
          ? `📋 Work Order Di-assign ke Anda`
          : `${priorityEmoji} Work Order Baru: ${data.workOrderNumber}`,
        message: `[${typeLabel}] ${data.title}`,
        link: `/admin/workorders/${data.workOrderId}`,
        userId: user.id,
        siteId: data.siteId,
        sourceType: "WORK_ORDER",
        sourceId: data.workOrderId,
      });
    }),
  );

  return { count: recipients.length };
}

export async function notifyWorkOrderAssigned(
  data: WorkOrderNotificationData & {
    assigneeName?: string;
    triggeredByUserId?: string;
  },
) {
  if (data.assignedToId && data.assignedToId !== data.triggeredByUserId) {
    await createNotification({
      type: "WORK_ORDER",
      priority: data.priority as NotificationPriority,
      title: `📋 Work Order Di-assign ke Anda`,
      message: `${data.workOrderNumber}: ${data.title}`,
      link: `/admin/workorders/${data.workOrderId}`,
      userId: data.assignedToId,
      siteId: data.siteId,
      sourceType: "WORK_ORDER",
      sourceId: data.workOrderId,
    });
  }

  const observers = await findEligibleRecipients(
    data.departmentId,
    data.siteId,
    data.assignedToId,
  );
  await Promise.all(
    observers.map((user: RecipientUser) =>
      createNotification({
        type: "WORK_ORDER",
        priority: "NORMAL",
        title: `👤 Work Order Ditugaskan`,
        message: `${data.workOrderNumber} ditugaskan kepada ${data.assigneeName || "user"}`,
        link: `/admin/workorders/${data.workOrderId}`,
        userId: user.id,
        siteId: data.siteId,
        sourceType: "WORK_ORDER",
        sourceId: data.workOrderId,
      }),
    ),
  );
}

export async function notifyWorkOrderStatusChange(
  data: WorkOrderNotificationData & {
    oldStatus: string;
    newStatus: string;
    triggeredByUserId?: string;
  },
) {
  const statusEmoji = getStatusEmoji(data.newStatus);
  const recipients = await findEligibleRecipients(
    data.departmentId,
    data.siteId,
    data.triggeredByUserId,
  );

  await Promise.all(
    recipients.map(async (user: RecipientUser) => {
      const isAssignee = user.id === data.assignedToId;
      await createNotification({
        type: "WORK_ORDER",
        priority: "NORMAL",
        title: isAssignee
          ? `${statusEmoji} Status WO Anda Berubah`
          : `${statusEmoji} Status WO Berubah`,
        message: `${data.workOrderNumber}: ${data.oldStatus} → ${data.newStatus}`,
        link: `/admin/workorders/${data.workOrderId}`,
        userId: user.id,
        siteId: data.siteId,
        sourceType: "WORK_ORDER",
        sourceId: data.workOrderId,
      });
    }),
  );
}

export async function notifyWorkOrderUpdate(
  data: WorkOrderNotificationData & {
    updateMessage: string;
    updatedByName?: string;
    triggeredByUserId?: string;
    excludeUserIds?: string[];
  },
) {
  const recipients = (
    await findEligibleRecipients(
      data.departmentId,
      data.siteId,
      data.triggeredByUserId,
    )
  ).filter((user: RecipientUser) => !data.excludeUserIds?.includes(user.id));

  await Promise.all(
    recipients.map(async (user: RecipientUser) => {
      await createNotification({
        type: "WORK_ORDER",
        priority: "NORMAL",
        title: `💬 Update pada ${data.workOrderNumber}`,
        message: data.updateMessage,
        link: `/admin/workorders/${data.workOrderId}`,
        userId: user.id,
        siteId: data.siteId,
        sourceType: "WORK_ORDER",
        sourceId: data.workOrderId,
      });
    }),
  );
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
  const emoji = getActionEmoji(data.actionType);
  const adminUsersRaw = await findEligibleRecipients(
    data.departmentId,
    data.siteId,
    data.triggeredByUserId,
  );
  const adminUsers = adminUsersRaw.filter(
    (u: RecipientUser) => u.id !== data.triggeredByUserId,
  );

  await Promise.all(
    adminUsers.map(async (user: RecipientUser) => {
      await createNotification({
        type: "WORK_ORDER",
        priority: "NORMAL",
        title: `${emoji} ${data.workOrderNumber}`,
        message: `${data.triggeredByName || "Teknisi"}: ${data.actionMessage}`,
        link: `/admin/workorders/${data.workOrderId}`,
        userId: user.id,
        siteId: data.siteId,
        sourceType: "WORK_ORDER",
        sourceId: data.workOrderId,
      });
    }),
  );

  return { count: adminUsers.length };
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
  const user = options?.departmentId
    ? null
    : await userRepo.findByIdWithDepartment(userId);
  const userDepartmentId =
    options?.departmentId || user?.departmentId || undefined;
  const { tenantId, isSuperAdmin } = await getTenantIdFromContext();
  const effectiveTenantId =
    !isSuperAdmin && !tenantId ? "___MISSING_TENANT_ID___" : tenantId;
  const tenantCondition = !isSuperAdmin ? { tenantId: effectiveTenantId } : {};

  const where: Prisma.NotificationsWhereInput = {
    ...tenantCondition,
    OR: [
      { userId },
      {
        AND: [
          { departmentId: userDepartmentId || "NONE" },
          options?.siteId
            ? { OR: [{ siteId: options.siteId }, { siteId: null }] }
            : {},
        ],
      },
    ],
  };

  if (options?.unreadOnly) where.isRead = false;
  if (options?.type) where.type = options.type;
  if (options?.excludeTypes && options.excludeTypes.length > 0)
    where.type = { notIn: options.excludeTypes };

  const [notifications, total] = await Promise.all([
    notificationRepo.findManyForUser(where, {
      take: options?.limit || 50,
      skip: options?.offset || 0,
    }),
    notificationRepo.countWhere(where),
  ]);

  return { notifications, total };
}

export async function getReadableNotificationForUser(
  notificationId: string,
  userId: string,
  options?: { departmentId?: string; siteId?: string },
) {
  const user = options?.departmentId
    ? null
    : await userRepo.findByIdWithDepartment(userId);
  const userDepartmentId =
    options?.departmentId || user?.departmentId || undefined;
  const { tenantId, isSuperAdmin } = await getTenantIdFromContext();
  const effectiveTenantId =
    !isSuperAdmin && !tenantId ? "___MISSING_TENANT_ID___" : tenantId;
  const tenantCondition = !isSuperAdmin ? { tenantId: effectiveTenantId } : {};

  return notificationRepo.findFirst({
    id: notificationId,
    ...tenantCondition,
    OR: [
      { userId },
      {
        AND: [
          { departmentId: userDepartmentId || "NONE" },
          options?.siteId
            ? { OR: [{ siteId: options.siteId }, { siteId: null }] }
            : {},
        ],
      },
    ],
  });
}

export async function getUnreadCount(
  userId: string,
  excludeTypes?: NotificationType[],
  siteId?: string,
): Promise<number> {
  const typeCondition =
    excludeTypes && excludeTypes.length > 0
      ? Prisma.sql`AND "type" NOT IN (${Prisma.join(excludeTypes)})`
      : Prisma.empty;
  const siteCondition = siteId
    ? Prisma.sql`AND ("siteId" = ${siteId} OR "siteId" IS NULL)`
    : Prisma.empty;
  const { tenantId, isSuperAdmin } = await getTenantIdFromContext();
  const effectiveTenantId =
    !isSuperAdmin && !tenantId ? "___MISSING_TENANT_ID___" : tenantId;
  const tenantCondition = !isSuperAdmin
    ? Prisma.sql`AND n."tenantId" = ${effectiveTenantId}`
    : Prisma.empty;

  return notificationRepo.getUnreadCountRaw(
    userId,
    typeCondition,
    siteCondition,
    tenantCondition,
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
  const user = await userRepo.findByIdWithDepartment(userId);
  const { tenantId, isSuperAdmin } = await getTenantIdFromContext();
  const effectiveTenantId =
    !isSuperAdmin && !tenantId ? "___MISSING_TENANT_ID___" : tenantId;
  const tenantCondition = !isSuperAdmin ? { tenantId: effectiveTenantId } : {};
  const where: Prisma.NotificationsWhereInput = {
    ...tenantCondition,
    isRead: false,
    OR: [
      { userId },
      {
        AND: [
          { departmentId: user?.departmentId || "NONE" },
          siteId ? { OR: [{ siteId: siteId }, { siteId: null }] } : {},
        ],
      },
    ],
  };
  if (type) where.type = type;
  return notificationRepo.updateMany(where, {
    isRead: true,
    readAt: new Date(),
  });
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

async function findCanvasingVerifiers(
  siteId?: string | null,
): Promise<RecipientUser[]> {
  const whereClause: Prisma.UserWhereInput = {
    isActive: true,
    role: { permission: { some: { resource: "canvasing", action: "verify" } } },
  };
  if (siteId) {
    whereClause.OR = [
      { siteId: siteId },
      { siteId: null },
      { userSites: { some: { siteId: siteId } } },
    ];
  }
  return userRepo.findManyWithCustomWhere(whereClause);
}

export async function notifyNewCanvasing(data: CanvasingNotificationData) {
  const recipients = await findCanvasingVerifiers(data.siteId);
  if (recipients.length === 0) {
    logger.warn(`[NotificationDebug] NO RECIPIENTS FOUND for New Canvasing.`);
    return null;
  }
  await Promise.all(
    recipients.map(async (user: RecipientUser) => {
      await createNotification({
        type: "ANNOUNCEMENT",
        priority: "NORMAL",
        title: "📋 Canvasing Baru",
        message: `Request canvasing baru untuk ${data.customerName} dari ${data.salesName || "Sales"}`,
        link: `/admin/marketing/canvasing/${data.canvasingId}`,
        userId: user.id,
        siteId: data.siteId || undefined,
        sourceType: "CANVASING",
        sourceId: data.canvasingId,
      });
    }),
  );
  return { count: recipients.length };
}

export async function notifyNewPointClaim(data: PointClaimNotificationData) {
  const recipients = await findCanvasingVerifiers(data.siteId);
  const filteredRecipients = recipients.filter(
    (user: RecipientUser) => user.id !== data.salesId,
  );
  if (filteredRecipients.length === 0) return null;

  await Promise.all(
    filteredRecipients.map(async (user: RecipientUser) => {
      await createNotification({
        type: "ANNOUNCEMENT",
        priority: "NORMAL",
        title: "🎁 Claim Poin Baru",
        message: `${data.salesName || "Sales"} mengajukan claim +${data.pointValue} poin untuk canvasing ${data.customerName}`,
        link: `/admin/marketing/canvasing/${data.canvasingId}`,
        userId: user.id,
        siteId: data.siteId || undefined,
        sourceType: "POINT_CLAIM",
        sourceId: data.claimId,
      });
    }),
  );
  return { count: filteredRecipients.length };
}
