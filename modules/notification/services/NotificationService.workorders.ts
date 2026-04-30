import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";
import type { UserLookupService } from "@/modules/users";
import {
  buildAssigneeTitle,
  buildAssignmentObserverTitle,
  buildNewWorkOrderMessage,
  buildStatusChangeMessage,
  buildStatusChangeTitle,
  buildWorkOrderUpdateTitle,
  resolveActionEmoji,
  resolvePriorityEmoji,
  resolveStatusEmoji,
  type EligibleUser,
  type RecipientUser,
} from "./NotificationService.helpers";
import type {
  CanvasingNotificationData,
  CreateNotificationData,
  NotificationPriority,
  PointClaimNotificationData,
  WorkOrderNotificationData,
} from "./NotificationService";

const WORK_ORDER_RESOURCE = "workorders";
const WORK_ORDER_READ_ACTION = "read";
const WORK_ORDER_DEPARTMENT_ONLY_ACTION = "department_only";
const DEFAULT_TRIGGERED_BY_NAME = "Teknisi";
const DEFAULT_SALES_NAME = "Sales";

/** Find work-order recipients allowed by current site and department rules. */
export async function findEligibleRecipients(input: {
  userLookupService: UserLookupService;
  departmentId?: string;
  siteId?: string;
  excludeUserId?: string;
}): Promise<RecipientUser[]> {
  if (!input.excludeUserId) {
    logger.warn(
      "[NotificationDebug] WARNING: findEligibleRecipients called without excludeUserId.",
    );
  }

  const whereClause = buildEligibleRecipientWhere(input);
  const users =
    await input.userLookupService.findManyWithDetailedRelations(whereClause);
  return users
    .filter((user: EligibleUser) => isEligibleRecipient(user, input))
    .map(mapRecipientUser);
}

/** Notify recipients about a newly created work order. */
export async function notifyNewWorkOrderRecipients(input: {
  data: WorkOrderNotificationData & { triggeredByUserId?: string };
  recipients: RecipientUser[];
  createNotification: (data: CreateNotificationData) => Promise<unknown>;
}): Promise<{ count: number } | null> {
  if (input.recipients.length === 0) {
    logger.warn(
      `[NotificationDebug] NO RECIPIENTS FOUND for New WO ${input.data.workOrderNumber}.`,
    );
    return null;
  }

  const priorityEmoji = resolvePriorityEmoji(input.data.priority);
  await Promise.all(
    input.recipients.map((recipient) =>
      input.createNotification(
        buildNewWorkOrderNotification(recipient, input.data, priorityEmoji),
      ),
    ),
  );
  return { count: input.recipients.length };
}

/** Notify the assignee and observer recipients for assignment changes. */
export async function notifyAssignedWorkOrderRecipients(input: {
  data: WorkOrderNotificationData & {
    assigneeName?: string;
    triggeredByUserId?: string;
  };
  observers: RecipientUser[];
  createNotification: (data: CreateNotificationData) => Promise<unknown>;
}): Promise<void> {
  await notifyWorkOrderAssignee(input.data, input.createNotification);
  await Promise.all(
    input.observers.map((recipient) =>
      input.createNotification(
        buildWorkOrderAssignmentObserverNotification(recipient, input.data),
      ),
    ),
  );
}

/** Notify recipients about one work-order status change. */
export async function notifyStatusChangedWorkOrderRecipients(input: {
  data: WorkOrderNotificationData & {
    oldStatus: string;
    newStatus: string;
    triggeredByUserId?: string;
  };
  recipients: RecipientUser[];
  createNotification: (data: CreateNotificationData) => Promise<unknown>;
}): Promise<void> {
  const statusEmoji = resolveStatusEmoji(input.data.newStatus);
  await Promise.all(
    input.recipients.map((recipient) =>
      input.createNotification(
        buildStatusChangedNotification(recipient, input.data, statusEmoji),
      ),
    ),
  );
}

/** Notify recipients about one work-order update event. */
export async function notifyUpdatedWorkOrderRecipients(input: {
  data: WorkOrderNotificationData & {
    updateMessage: string;
    updatedByName?: string;
    triggeredByUserId?: string;
    excludeUserIds?: string[];
  };
  recipients: RecipientUser[];
  createNotification: (data: CreateNotificationData) => Promise<unknown>;
}): Promise<void> {
  const filteredRecipients = input.recipients.filter(
    (recipient) => !input.data.excludeUserIds?.includes(recipient.id),
  );
  await Promise.all(
    filteredRecipients.map((recipient) =>
      input.createNotification(
        buildWorkOrderUpdateNotification(recipient, input.data),
      ),
    ),
  );
}

/** Notify admins about a work-order action coming from mobile. */
export async function notifyMobileActionRecipients(input: {
  data: {
    workOrderId: string;
    workOrderNumber: string;
    title: string;
    actionType: string;
    actionMessage: string;
    triggeredByUserId: string;
    triggeredByName?: string;
    departmentId?: string;
    siteId?: string;
  };
  recipients: RecipientUser[];
  createNotification: (data: CreateNotificationData) => Promise<unknown>;
}): Promise<{ count: number }> {
  const emoji = resolveActionEmoji(input.data.actionType);
  const adminRecipients = input.recipients.filter(
    (recipient) => recipient.id !== input.data.triggeredByUserId,
  );
  await Promise.all(
    adminRecipients.map((recipient) =>
      input.createNotification({
        type: "WORK_ORDER",
        priority: "NORMAL",
        title: `${emoji} ${input.data.workOrderNumber}`,
        message: `${input.data.triggeredByName || DEFAULT_TRIGGERED_BY_NAME}: ${input.data.actionMessage}`,
        link: `/admin/workorders/${input.data.workOrderId}`,
        userId: recipient.id,
        siteId: input.data.siteId,
        sourceType: "WORK_ORDER",
        sourceId: input.data.workOrderId,
      }),
    ),
  );
  return { count: adminRecipients.length };
}

/** Notify canvasing verifiers about a new canvasing request. */
export async function notifyNewCanvasingRecipients(input: {
  data: CanvasingNotificationData;
  recipients: RecipientUser[];
  createNotification: (data: CreateNotificationData) => Promise<unknown>;
  buildCanvasingTitle: () => string;
}): Promise<{ count: number } | null> {
  if (input.recipients.length === 0) {
    logger.warn("[NotificationDebug] NO RECIPIENTS FOUND for New Canvasing.");
    return null;
  }

  await Promise.all(
    input.recipients.map((recipient) =>
      input.createNotification({
        type: "ANNOUNCEMENT",
        priority: "NORMAL",
        title: input.buildCanvasingTitle(),
        message: `Request canvasing baru untuk ${input.data.customerName} dari ${input.data.salesName || DEFAULT_SALES_NAME}`,
        link: `/admin/marketing/canvasing/${input.data.canvasingId}`,
        userId: recipient.id,
        siteId: input.data.siteId || undefined,
        sourceType: "CANVASING",
        sourceId: input.data.canvasingId,
      }),
    ),
  );
  return { count: input.recipients.length };
}

/** Notify canvasing verifiers about a new point claim. */
export async function notifyNewPointClaimRecipients(input: {
  data: PointClaimNotificationData;
  recipients: RecipientUser[];
  createNotification: (data: CreateNotificationData) => Promise<unknown>;
  buildPointClaimTitle: () => string;
}): Promise<{ count: number } | null> {
  const filteredRecipients = input.recipients.filter(
    (recipient) => recipient.id !== input.data.salesId,
  );
  if (filteredRecipients.length === 0) {
    return null;
  }

  await Promise.all(
    filteredRecipients.map((recipient) =>
      input.createNotification({
        type: "ANNOUNCEMENT",
        priority: "NORMAL",
        title: input.buildPointClaimTitle(),
        message: `${input.data.salesName || DEFAULT_SALES_NAME} mengajukan claim +${input.data.pointValue} poin untuk canvasing ${input.data.customerName}`,
        link: `/admin/marketing/canvasing/${input.data.canvasingId}`,
        userId: recipient.id,
        siteId: input.data.siteId || undefined,
        sourceType: "POINT_CLAIM",
        sourceId: input.data.claimId,
      }),
    ),
  );
  return { count: filteredRecipients.length };
}

/** Find canvasing verifiers for one site scope. */
export async function findCanvasingVerifiers(input: {
  userLookupService: UserLookupService;
  siteId?: string | null;
}): Promise<RecipientUser[]> {
  return input.userLookupService.findManyWithCustomWhere({
    isActive: true,
    role: { permission: { some: { resource: "canvasing", action: "verify" } } },
    ...(input.siteId
      ? {
          OR: [
            { siteId: input.siteId },
            { siteId: null },
            { userSites: { some: { siteId: input.siteId } } },
          ],
        }
      : {}),
  });
}

function buildEligibleRecipientWhere(input: {
  departmentId?: string;
  siteId?: string;
  excludeUserId?: string;
}): Prisma.UserWhereInput {
  const baseWhere: Prisma.UserWhereInput = {
    isActive: true,
    ...(input.excludeUserId ? { id: { not: input.excludeUserId } } : {}),
    role: {
      permission: {
        some: { resource: WORK_ORDER_RESOURCE, action: WORK_ORDER_READ_ACTION },
      },
    },
  };

  const siteConditions = input.siteId
    ? buildSiteConditions(input.siteId)
    : undefined;
  if (!input.departmentId) {
    return { ...baseWhere, ...(siteConditions ? { OR: siteConditions } : {}) };
  }

  return {
    ...baseWhere,
    OR: buildDepartmentScopedConditions(input.departmentId, siteConditions),
  };
}

function buildSiteConditions(siteId: string): Prisma.UserWhereInput[] {
  return [{ siteId }, { siteId: null }, { userSites: { some: { siteId } } }];
}

function buildDepartmentScopedConditions(
  departmentId: string,
  siteConditions?: Prisma.UserWhereInput[],
): Prisma.UserWhereInput[] {
  const departmentConditions = [
    { departmentId },
    { departmentId: null },
    {
      role: {
        permission: {
          none: {
            resource: WORK_ORDER_RESOURCE,
            action: WORK_ORDER_DEPARTMENT_ONLY_ACTION,
          },
        },
      },
    },
  ];

  if (!siteConditions) {
    return departmentConditions;
  }

  return siteConditions.map((siteCondition) => ({
    ...siteCondition,
    OR: departmentConditions,
  }));
}

function isEligibleRecipient(
  user: EligibleUser,
  input: { excludeUserId?: string; siteId?: string },
): boolean {
  if (input.excludeUserId && user.id === input.excludeUserId) {
    return false;
  }
  if (!user.role?.permission?.length || !input.siteId) {
    return true;
  }

  const userSiteIds = user.userSites?.map((userSite) => userSite.siteId) || [];
  return (
    userSiteIds.includes(input.siteId) ||
    user.siteId === input.siteId ||
    user.siteId === null
  );
}

function mapRecipientUser(user: { id: string }): RecipientUser {
  return { id: user.id };
}

async function notifyWorkOrderAssignee(
  data: WorkOrderNotificationData & { triggeredByUserId?: string },
  createNotification: (data: CreateNotificationData) => Promise<unknown>,
): Promise<void> {
  if (!data.assignedToId || data.assignedToId === data.triggeredByUserId) {
    return;
  }

  await createNotification({
    type: "WORK_ORDER",
    priority: data.priority as NotificationPriority,
    title: "📋 Work Order Di-assign ke Anda",
    message: `${data.workOrderNumber}: ${data.title}`,
    link: `/admin/workorders/${data.workOrderId}`,
    userId: data.assignedToId,
    siteId: data.siteId,
    sourceType: "WORK_ORDER",
    sourceId: data.workOrderId,
  });
}

function buildNewWorkOrderNotification(
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

function buildWorkOrderAssignmentObserverNotification(
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

function buildStatusChangedNotification(
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

function buildWorkOrderUpdateNotification(
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
