import { eventBus, EVENT_NAMES } from "@/lib/event-bus";

export class WorkOrderEventDispatcher {
  /**
   * Dipanggil setelah Work Order baru dibuat.
   */
  static async onCreated(data: {
    workOrderId: string;
    workOrderNumber: string;
    title: string;
    type: string;
    priority: string;
    departmentId?: string | null;
    siteId?: string | null;
    assignedToId?: string | null;
    tenantId?: string;
    triggeredBy?: string;
  }) {
    await eventBus.publish(EVENT_NAMES.WORK_ORDER_CREATED, {
      workOrderId: data.workOrderId,
      workOrderNumber: data.workOrderNumber,
      title: data.title,
      type: data.type,
      priority: data.priority,
      departmentId: data.departmentId ?? undefined,
      siteId: data.siteId ?? undefined,
      assignedToId: data.assignedToId ?? undefined,
      tenantId: data.tenantId,
      triggeredBy: data.triggeredBy,
    });
  }

  /**
   * Dipanggil setelah Work Order ditugaskan ke karyawan.
   */
  static async onAssigned(data: {
    workOrderId: string;
    workOrderNumber: string;
    title: string;
    assignedToId: string;
    assignedToName?: string;
    departmentId?: string | null;
    siteId?: string | null;
    tenantId?: string;
    triggeredBy?: string;
  }) {
    await eventBus.publish(EVENT_NAMES.WORK_ORDER_ASSIGNED, {
      workOrderId: data.workOrderId,
      workOrderNumber: data.workOrderNumber,
      title: data.title,
      assignedToId: data.assignedToId,
      assignedToName: data.assignedToName,
      departmentId: data.departmentId ?? undefined,
      siteId: data.siteId ?? undefined,
      tenantId: data.tenantId,
      triggeredBy: data.triggeredBy,
    });
  }

  /**
   * Dipanggil setelah Work Order diupdate.
   */
  static async onUpdated(data: {
    workOrderId: string;
    workOrderNumber: string;
    title: string;
    updateMessage: string;
    updatedByName?: string;
    departmentId?: string | null;
    siteId?: string | null;
    assignedToId?: string | null;
    excludeUserIds?: string[];
    tenantId?: string;
    triggeredBy?: string;
  }) {
    await eventBus.publish(EVENT_NAMES.WORK_ORDER_UPDATED, {
      workOrderId: data.workOrderId,
      workOrderNumber: data.workOrderNumber,
      title: data.title,
      updateMessage: data.updateMessage,
      updatedByName: data.updatedByName,
      departmentId: data.departmentId ?? undefined,
      siteId: data.siteId ?? undefined,
      assignedToId: data.assignedToId ?? undefined,
      excludeUserIds: data.excludeUserIds,
      tenantId: data.tenantId,
      triggeredBy: data.triggeredBy,
    });
  }

  /**
   * Dipanggil setelah Work Order diselesaikan.
   */
  static async onCompleted(data: {
    workOrderId: string;
    workOrderNumber: string;
    title: string;
    completedByName?: string;
    departmentId?: string | null;
    siteId?: string | null;
    assignedToId?: string | null;
    tenantId?: string;
    triggeredBy?: string;
  }) {
    await eventBus.publish(EVENT_NAMES.WORK_ORDER_COMPLETED, {
      workOrderId: data.workOrderId,
      workOrderNumber: data.workOrderNumber,
      title: data.title,
      completedByName: data.completedByName,
      departmentId: data.departmentId ?? undefined,
      siteId: data.siteId ?? undefined,
      assignedToId: data.assignedToId ?? undefined,
      tenantId: data.tenantId,
      triggeredBy: data.triggeredBy,
    });
  }

  /**
   * Dipanggil setelah aktivitas (komentar/update/attachment) ditambahkan.
   */
  static async onActivity(data: {
    workOrderId: string;
    activityId: string;
    activityType: "comment" | "update" | "attachment";
    message?: string;
    userName?: string;
    tenantId?: string;
    triggeredBy?: string;
  }) {
    await eventBus.publish(EVENT_NAMES.WORK_ORDER_ACTIVITY, {
      workOrderId: data.workOrderId,
      activityId: data.activityId,
      activityType: data.activityType,
      message: data.message,
      userName: data.userName,
      tenantId: data.tenantId,
      triggeredBy: data.triggeredBy,
    });
  }
}
