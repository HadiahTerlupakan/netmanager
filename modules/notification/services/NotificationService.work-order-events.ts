import { UserLookupService } from "@/modules/users";
import { findEligibleRecipients } from "./NotificationService.recipients";
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

type WorkOrderObserverInput = {
  departmentId?: string;
  siteId?: string;
  excludeUserId?: string;
};

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

export async function notifyWorkOrderAssignedEvent(input: {
  userLookupService: UserLookupService;
  createNotification: (data: CreateNotificationData) => Promise<unknown>;
  data: WorkOrderNotificationData & {
    assigneeName?: string;
    triggeredByUserId?: string;
  };
}) {
  const observers = await findWorkOrderObservers(
    input,
    buildAssignedObserverInput(input.data),
  );
  await notifyAssignedWorkOrderRecipients({
    data: input.data,
    observers,
    createNotification: input.createNotification,
  });
}

export async function notifyWorkOrderStatusChangeEvent(input: {
  userLookupService: UserLookupService;
  createNotification: (data: CreateNotificationData) => Promise<unknown>;
  data: WorkOrderNotificationData & {
    oldStatus: string;
    newStatus: string;
    triggeredByUserId?: string;
  };
}) {
  const recipients = await findWorkOrderObservers(
    input,
    buildTriggeredObserverInput(input.data),
  );
  await notifyStatusChangedWorkOrderRecipients({
    data: input.data,
    recipients,
    createNotification: input.createNotification,
  });
}

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
  const recipients = await findWorkOrderObservers(
    input,
    buildTriggeredObserverInput(input.data),
  );
  await notifyUpdatedWorkOrderRecipients({
    data: input.data,
    recipients,
    createNotification: input.createNotification,
  });
}

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
    };
  },
) {
  return {
    data: input.data,
    recipients: await findTriggeredWorkOrderObservers(input),
    createNotification: input.createNotification,
  };
}

async function findTriggeredWorkOrderObservers(
  input: WorkOrderNotificationDependencies & {
    data: {
      departmentId?: string;
      siteId?: string;
      triggeredByUserId?: string;
    };
  },
) {
  return findWorkOrderObservers(input, buildTriggeredObserverInput(input.data));
}

async function findWorkOrderObservers(
  input: WorkOrderNotificationDependencies,
  observerInput: WorkOrderObserverInput,
) {
  return findEligibleRecipients({
    userLookupService: input.userLookupService,
    departmentId: observerInput.departmentId,
    siteId: observerInput.siteId,
    excludeUserId: observerInput.excludeUserId,
  });
}

function buildAssignedObserverInput(
  data: WorkOrderNotificationData & { assignedToId?: string | null },
): WorkOrderObserverInput {
  return {
    departmentId: data.departmentId,
    siteId: data.siteId,
    excludeUserId: data.assignedToId || undefined,
  };
}

function buildTriggeredObserverInput(data: {
  departmentId?: string;
  siteId?: string;
  triggeredByUserId?: string;
}): WorkOrderObserverInput {
  return {
    departmentId: data.departmentId,
    siteId: data.siteId,
    excludeUserId: data.triggeredByUserId,
  };
}
