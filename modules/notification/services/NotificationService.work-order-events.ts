import { UserLookupService } from "@/modules/users";
import {
  findEligibleRecipients,
  findWorkOrderStakeholders,
} from "./NotificationService.recipients";
import type {
  CreateNotificationData,
  WorkOrderNotificationData,
} from "./NotificationService.types";
import {
  notifyAssignedWorkOrderRecipients,
  notifyMobileActionRecipients,
  notifyNewWorkOrderRecipients,
  notifyStatusChangedWorkOrderRecipients,
  notifyUpdatedWorkOrderRecipients,
} from "./NotificationService.workorders";

type WorkOrderNotificationDependencies = {
  userLookupService: UserLookupService;
  createNotification: (data: CreateNotificationData) => Promise<unknown>;
};

type StakeholderScopeInput = {
  workOrderId: string;
  departmentId?: string;
  siteId?: string;
  assignedToId?: string | null;
  createdById?: string | null;
  requestedById?: string | null;
  excludeUserId?: string;
};

/** WO Baru → POOL (dept+site ketat). */
export async function notifyNewWorkOrderEvent(input: {
  userLookupService: UserLookupService;
  createNotification: (data: CreateNotificationData) => Promise<unknown>;
  data: WorkOrderNotificationData & { triggeredByUserId?: string };
}) {
  const recipients = await findEligibleRecipients({
    userLookupService: input.userLookupService,
    departmentId: input.data.departmentId,
    siteId: input.data.siteId,
    excludeUserId: input.data.triggeredByUserId,
  });

  return notifyNewWorkOrderRecipients({
    data: input.data,
    recipients,
    createNotification: input.createNotification,
  });
}

/** Assign → assignee + STAKEHOLDERS observers (bukan full POOL). */
export async function notifyWorkOrderAssignedEvent(input: {
  userLookupService: UserLookupService;
  createNotification: (data: CreateNotificationData) => Promise<unknown>;
  data: WorkOrderNotificationData & {
    assigneeName?: string;
    triggeredByUserId?: string;
  };
}) {
  const observers = await findWorkOrderStakeholders({
    userLookupService: input.userLookupService,
    workOrderId: input.data.workOrderId,
    siteId: input.data.siteId,
    departmentId: input.data.departmentId,
    assignedToId: input.data.assignedToId,
    createdById: input.data.createdById,
    requestedById: input.data.requestedById,
    // Assignee gets dedicated "Di-assign ke Anda"; exclude from observers.
    excludeUserId: input.data.assignedToId || input.data.triggeredByUserId,
  });
  await notifyAssignedWorkOrderRecipients({
    data: input.data,
    observers,
    createNotification: input.createNotification,
  });
}

/** Status change → STAKEHOLDERS only. */
export async function notifyWorkOrderStatusChangeEvent(input: {
  userLookupService: UserLookupService;
  createNotification: (data: CreateNotificationData) => Promise<unknown>;
  data: WorkOrderNotificationData & {
    oldStatus: string;
    newStatus: string;
    triggeredByUserId?: string;
  };
}) {
  const recipients = await resolveStakeholders(input, {
    workOrderId: input.data.workOrderId,
    departmentId: input.data.departmentId,
    siteId: input.data.siteId,
    assignedToId: input.data.assignedToId,
    createdById: input.data.createdById,
    requestedById: input.data.requestedById,
    excludeUserId: input.data.triggeredByUserId,
  });
  await notifyStatusChangedWorkOrderRecipients({
    data: input.data,
    recipients,
    createNotification: input.createNotification,
  });
}

/** Update event → STAKEHOLDERS only. */
export async function notifyWorkOrderUpdateEvent(input: {
  userLookupService: UserLookupService;
  createNotification: (data: CreateNotificationData) => Promise<unknown>;
  data: WorkOrderNotificationData & {
    updateMessage: string;
    updatedByName?: string;
    triggeredByUserId?: string;
    excludeUserIds?: string[];
  };
}) {
  const recipients = await resolveStakeholders(input, {
    workOrderId: input.data.workOrderId,
    departmentId: input.data.departmentId,
    siteId: input.data.siteId,
    assignedToId: input.data.assignedToId,
    createdById: input.data.createdById,
    requestedById: input.data.requestedById,
    excludeUserId: input.data.triggeredByUserId,
  });
  await notifyUpdatedWorkOrderRecipients({
    data: input.data,
    recipients,
    createNotification: input.createNotification,
  });
}

/**
 * Mobile action (claim/inventory/complete/note) → STAKEHOLDERS.
 * Nama export tetap notifyAdmins* untuk kompatibilitas; audience bukan pool.
 */
export async function notifyAdminsAboutMobileActionEvent(input: {
  userLookupService: UserLookupService;
  createNotification: (data: CreateNotificationData) => Promise<unknown>;
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
    assignedToId?: string | null;
    createdById?: string | null;
    requestedById?: string | null;
  };
}) {
  return notifyMobileActionRecipients(
    await buildMobileActionEventNotification(input),
  );
}

async function buildMobileActionEventNotification(
  input: WorkOrderNotificationDependencies & {
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
      assignedToId?: string | null;
      createdById?: string | null;
      requestedById?: string | null;
    };
  },
) {
  return {
    data: input.data,
    recipients: await resolveStakeholders(input, {
      workOrderId: input.data.workOrderId,
      departmentId: input.data.departmentId,
      siteId: input.data.siteId,
      assignedToId: input.data.assignedToId,
      createdById: input.data.createdById,
      requestedById: input.data.requestedById,
      excludeUserId: input.data.triggeredByUserId,
    }),
    createNotification: input.createNotification,
  };
}

async function resolveStakeholders(
  input: WorkOrderNotificationDependencies,
  scope: StakeholderScopeInput,
) {
  return findWorkOrderStakeholders({
    userLookupService: input.userLookupService,
    workOrderId: scope.workOrderId,
    siteId: scope.siteId,
    departmentId: scope.departmentId,
    assignedToId: scope.assignedToId,
    createdById: scope.createdById,
    requestedById: scope.requestedById,
    excludeUserId: scope.excludeUserId,
  });
}
