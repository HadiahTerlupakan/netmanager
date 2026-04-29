import { logger } from "@/lib/logger";
import {
  sendPushNotification as sendExpoPush,
  sendPushToDepartment as sendExpoPushToDepartment,
} from "./ExpoPushService";
import { NotificationRepository } from "../repositories/NotificationRepository";
import { UserLookupService } from "@/modules/users";
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

type NotificationAccessScopeInput = {
  userId: string;
  departmentId?: string;
  siteId?: string;
};

type NotificationAccessScope = {
  departmentId?: string;
  tenantCondition: Prisma.NotificationsWhereInput;
};

const notificationRepo = new NotificationRepository();
const userRepo = new UserLookupService();
const MISSING_TENANT_ID = "___MISSING_TENANT_ID___";
const FALLBACK_DEPARTMENT_ID = "NONE";
const DEFAULT_NOTIFICATION_LIMIT = 50;
const DEFAULT_NOTIFICATION_OFFSET = 0;

async function resolveNotificationAccessScope(
  input: NotificationAccessScopeInput,
): Promise<NotificationAccessScope> {
  const user = input.departmentId
    ? null
    : await userRepo.findByIdWithDepartment(input.userId);
  const { tenantId, isSuperAdmin } = await getTenantIdFromContext();
  const effectiveTenantId =
    !isSuperAdmin && !tenantId ? MISSING_TENANT_ID : tenantId;

  return {
    departmentId: input.departmentId || user?.departmentId || undefined,
    tenantCondition: !isSuperAdmin ? { tenantId: effectiveTenantId } : {},
  };
}

function buildNotificationAccessWhere(
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

function resolveNotificationQueryOptions(options?: {
  limit?: number;
  offset?: number;
}) {
  return {
    take: options?.limit || DEFAULT_NOTIFICATION_LIMIT,
    skip: options?.offset || DEFAULT_NOTIFICATION_OFFSET,
  };
}

function buildTenantSqlCondition(
  isSuperAdmin: boolean,
  tenantId?: string | null,
) {
  if (isSuperAdmin) {
    return Prisma.empty;
  }

  return Prisma.sql`AND n."tenantId" = ${tenantId || MISSING_TENANT_ID}`;
}

function buildExcludedTypesSqlCondition(excludeTypes?: NotificationType[]) {
  return excludeTypes && excludeTypes.length > 0
    ? Prisma.sql`AND "type" NOT IN (${Prisma.join(excludeTypes)})`
    : Prisma.empty;
}

function buildSiteSqlCondition(siteId?: string) {
  return siteId
    ? Prisma.sql`AND ("siteId" = ${siteId} OR "siteId" IS NULL)`
    : Prisma.empty;
}

function buildNotificationMutationPayload() {
  return {
    isRead: true,
    readAt: new Date(),
  };
}

function shouldNotifyAdmins(data: CreateNotificationData) {
  return (
    data.priority === "HIGH" ||
    data.priority === "URGENT" ||
    data.type === "ALERT"
  );
}

function buildNotificationPushMetadata(
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

function buildWebsocketPayload(
  notification: Awaited<ReturnType<typeof notificationRepo.createFull>>,
) {
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

function buildNotificationCreateData(
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

function buildAdminNotificationSiteId(siteId?: string) {
  return siteId;
}

function buildAssigneeTitle(
  isAssignee: boolean,
  priorityEmoji: string,
  workOrderNumber: string,
) {
  return isAssignee
    ? `📋 Work Order Di-assign ke Anda`
    : `${priorityEmoji} Work Order Baru: ${workOrderNumber}`;
}

function buildStatusChangeTitle(isAssignee: boolean, statusEmoji: string) {
  return isAssignee
    ? `${statusEmoji} Status WO Anda Berubah`
    : `${statusEmoji} Status WO Berubah`;
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
  const wsPayload = buildWebsocketPayload(notification);
  const pushMetadata = buildNotificationPushMetadata(notification.id, data);

  if (data.userId) {
    socketEmitter.notifyUser(data.userId, wsPayload);

    const directRecipient = await userRepo.findByIdWithPushToken(data.userId);
    if (directRecipient?.fcmTokens?.length) {
      sendFCMNotification(
        directRecipient.fcmTokens,
        data.title,
        data.message,
        pushMetadata,
      ).catch((err) => logger.error("[FCM Push] Error:", err));
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
      sendFCMNotification(
        departmentFcmTokens,
        data.title,
        data.message,
        pushMetadata,
      ).catch((err) => logger.error("[FCM Push Dept] Error:", err));
    }

    if (!data.skipExpoPush) {
      sendExpoPushToDepartment(data.departmentId, data.title, data.message, {
        link: data.link || undefined,
        sourceType: data.sourceType || undefined,
        sourceId: data.sourceId || undefined,
      }).catch((err) => logger.error("[Expo Push Dept] Error:", err));
    }
  }

  if (shouldNotifyAdmins(data)) {
    socketEmitter.notifyAdmins(
      wsPayload,
      buildAdminNotificationSiteId(data.siteId),
    );

    const adminTokens = await getAdminTokens();
    if (adminTokens.length > 0) {
      sendFCMNotification(
        adminTokens,
        data.title,
        data.message,
        pushMetadata,
      ).catch((err) => logger.error("[FCM Push Admin] Error:", err));
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
        title: buildAssigneeTitle(
          isAssignee,
          priorityEmoji,
          data.workOrderNumber,
        ),
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
        title: buildStatusChangeTitle(isAssignee, statusEmoji),
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
