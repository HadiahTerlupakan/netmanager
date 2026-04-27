import { prisma } from "@/modules/database";
import { sendWorkOrderReminder } from "./WorkOrderNotifications";

const STALE_WORK_ORDER_LIMIT = 100;
const STALE_WORK_ORDER_AGE_MS = 24 * 60 * 60 * 1000;

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

type StaleWorkOrder = Awaited<ReturnType<typeof findStaleWorkOrders>>[number];

/** Sends reminder notifications for stale active work orders. */
export async function runWorkOrderReminderCron(
  now = new Date(),
): Promise<WorkOrderReminderCronResult> {
  const staleWorkOrders = await findStaleWorkOrders(now);
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

function findStaleWorkOrders(now: Date) {
  return prisma.workOrders.findMany({
    where: {
      status: { in: ["PENDING", "ASSIGNED", "IN_PROGRESS"] },
      createdAt: { lte: new Date(now.getTime() - STALE_WORK_ORDER_AGE_MS) },
    },
    select: {
      id: true,
      workOrderNumber: true,
      title: true,
      type: true,
      priority: true,
      status: true,
      departmentId: true,
      siteId: true,
      assignedToId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
    take: STALE_WORK_ORDER_LIMIT,
  });
}

async function sendReminderBatch(workOrders: StaleWorkOrder[], now: Date) {
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
      {
        id: workOrder.id,
        workOrderNumber: workOrder.workOrderNumber,
        title: workOrder.title,
        type: workOrder.type,
        priority: workOrder.priority,
        departmentId: workOrder.departmentId,
        siteId: workOrder.siteId,
        assignedToId: workOrder.assignedToId,
      },
      buildReminderMessage(workOrder, ageHours),
    );

    return {
      workOrderId: workOrder.id,
      workOrderNumber: workOrder.workOrderNumber,
      status: workOrder.status,
      ageHours,
      sentCount,
    };
  } catch (error) {
    console.error(
      `[Cron WO Reminder] Error sending reminder for ${workOrder.workOrderNumber}:`,
      error,
    );
    return null;
  }
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
