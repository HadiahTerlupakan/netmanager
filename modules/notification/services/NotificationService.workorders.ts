import type {
  CreateNotificationData,
  NotificationPriority,
  WorkOrderNotificationData,
} from "./NotificationService.types";
import {
  resolveActionEmoji,
  resolvePriorityEmoji,
  resolveStatusEmoji,
  type RecipientUser,
} from "./NotificationService.helpers";

type MobileActionNotificationData = {
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
import {
  buildNewWorkOrderNotification,
  buildStatusChangedNotification,
  buildWorkOrderAssignmentObserverNotification,
  buildWorkOrderUpdateNotification,
} from "./NotificationService.workorder-builders";

const DEFAULT_TRIGGERED_BY_NAME = "Teknisi";

/** Notify recipients about a newly created work order. */
export async function notifyNewWorkOrderRecipients(input: {
  data: WorkOrderNotificationData & { triggeredByUserId?: string };
  recipients: RecipientUser[];
  createNotification: (data: CreateNotificationData) => Promise<unknown>;
}): Promise<{ count: number } | null> {
  if (input.recipients.length === 0) {
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
  await Promise.all(
    filterWorkOrderRecipients(input.recipients, input.data.excludeUserIds).map(
      (recipient) =>
        input.createNotification(
          buildWorkOrderUpdateNotification(recipient, input.data),
        ),
    ),
  );
}

function filterWorkOrderRecipients(
  recipients: RecipientUser[],
  excludeUserIds?: string[],
) {
  return recipients.filter(
    (recipient) => !excludeUserIds?.includes(recipient.id),
  );
}

/** Notify admins about a work-order action coming from mobile. */
export async function notifyMobileActionRecipients(input: {
  data: MobileActionNotificationData;
  recipients: RecipientUser[];
  createNotification: (data: CreateNotificationData) => Promise<unknown>;
}): Promise<{ count: number }> {
  return createMobileActionNotifications(
    input.data,
    input.recipients,
    input.createNotification,
  );
}

export async function createMobileActionNotifications(
  data: MobileActionNotificationData,
  recipients: RecipientUser[],
  createNotification: (data: CreateNotificationData) => Promise<unknown>,
): Promise<{ count: number }> {
  const adminRecipients = filterMobileActionRecipients(
    recipients,
    data.triggeredByUserId,
  );
  const emoji = resolveActionEmoji(data.actionType);
  await Promise.all(
    adminRecipients.map((recipient) =>
      createNotification(buildMobileActionNotification(recipient, data, emoji)),
    ),
  );
  return { count: adminRecipients.length };
}

function filterMobileActionRecipients(
  recipients: RecipientUser[],
  triggeredByUserId: string,
) {
  return recipients.filter((recipient) => recipient.id !== triggeredByUserId);
}

function buildMobileActionNotification(
  recipient: RecipientUser,
  data: Pick<
    MobileActionNotificationData,
    | "workOrderId"
    | "workOrderNumber"
    | "actionMessage"
    | "triggeredByName"
    | "siteId"
  >,
  emoji: string,
): CreateNotificationData {
  return {
    type: "WORK_ORDER",
    priority: "NORMAL",
    title: `${emoji} ${data.workOrderNumber}`,
    message: `${data.triggeredByName || DEFAULT_TRIGGERED_BY_NAME}: ${data.actionMessage}`,
    link: `/admin/workorders/${data.workOrderId}`,
    userId: recipient.id,
    siteId: data.siteId,
    sourceType: "WORK_ORDER",
    sourceId: data.workOrderId,
  };
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
