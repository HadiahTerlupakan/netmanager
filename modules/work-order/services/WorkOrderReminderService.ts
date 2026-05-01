import { logger } from "@/lib/logger";
import { WorkOrderRepository } from "../repositories/WorkOrderRepository";
import { sendWorkOrderReminder } from "./WorkOrderNotifications";

export interface WorkOrderReminderResult {
  workOrderId: string;
  workOrderNumber: string;
  status: string;
  ageHours: number;
  sentCount: number;
}

export type WorkOrderReminderCronResult = {
  timestamp: string;
  summary: {
    staleWorkOrders: number;
    totalRemindersSent: number;
  };
  details: WorkOrderReminderResult[];
};

type StaleWorkOrder = Awaited<
  ReturnType<WorkOrderRepository["findStaleReminderWorkOrders"]>
>[number];

/** Sends reminder notifications for stale active work orders. */
export async function runWorkOrderReminderCron(
  now = new Date(),
  repo: WorkOrderRepositoryReader = new WorkOrderRepository(),
): Promise<WorkOrderReminderCronResult> {
  const staleWorkOrders = await repo.findStaleReminderWorkOrders(now);
  const details = await sendReminderBatch(staleWorkOrders, now);

  return {
    timestamp: now.toISOString(),
    summary: {
      staleWorkOrders: staleWorkOrders.length,
      totalRemindersSent: sumSentCount(details),
    },
    details,
  };
}

async function sendReminderBatch(
  workOrders: StaleWorkOrder[],
  now: Date,
): Promise<WorkOrderReminderResult[]> {
  const results: WorkOrderReminderResult[] = [];

  for (const workOrder of workOrders) {
    const result = await sendReminder(workOrder, now);

    if (result) {
      results.push(result);
    }
  }

  return results;
}

async function sendReminder(workOrder: StaleWorkOrder, now: Date) {
  const ageHours = calculateAgeHours(workOrder.createdAt, now);

  try {
    const sentCount = await sendWorkOrderReminder(
      toReminderWorkOrderPayload(workOrder),
      buildReminderMessage(workOrder, ageHours),
    );

    return buildReminderResult(workOrder, ageHours, sentCount);
  } catch (error) {
    logger.error(
      `[Cron WO Reminder] Error sending reminder for ${workOrder.workOrderNumber}:`,
      error,
    );
    return null;
  }
}

/** Bentuk payload reminder dari entity work order stale. */
function toReminderWorkOrderPayload(workOrder: StaleWorkOrder) {
  return {
    id: workOrder.id,
    workOrderNumber: workOrder.workOrderNumber,
    title: workOrder.title,
    type: workOrder.type,
    priority: workOrder.priority,
    departmentId: workOrder.departmentId,
    siteId: workOrder.siteId,
    assignedToId: workOrder.assignedToId,
  };
}

/** Bentuk hasil reminder untuk laporan cron. */
function buildReminderResult(
  workOrder: StaleWorkOrder,
  ageHours: number,
  sentCount: number,
): WorkOrderReminderResult {
  return {
    workOrderId: workOrder.id,
    workOrderNumber: workOrder.workOrderNumber,
    status: workOrder.status,
    ageHours,
    sentCount,
  };
}

function calculateAgeHours(createdAt: Date, now: Date) {
  return Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
}

function buildReminderMessage(workOrder: StaleWorkOrder, ageHours: number) {
  if (workOrder.status === "PENDING") {
    return `⏰ WO Menunggu ${ageHours} jam! ${workOrder.workOrderNumber} - ${workOrder.title}`;
  }

  if (workOrder.status === "ASSIGNED") {
    return `⏰ WO Belum Dikerjakan ${ageHours} jam! ${workOrder.workOrderNumber} - ${workOrder.title}`;
  }

  return `⏰ WO Sedang Proses ${ageHours} jam! ${workOrder.workOrderNumber} - ${workOrder.title}`;
}

function sumSentCount(results: WorkOrderReminderResult[]) {
  return results.reduce((total, result) => total + result.sentCount, 0);
}
