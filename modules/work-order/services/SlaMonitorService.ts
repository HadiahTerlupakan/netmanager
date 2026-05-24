import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendWorkOrderReminder } from "./WorkOrderNotifications";

/**
 * Status breach SLA per WO.
 * - OK: masih dalam target
 * - AT_RISK: ≥80% target sudah terpakai
 * - BREACHED: melebihi target
 */
export type SlaBreachLevel = "OK" | "AT_RISK" | "BREACHED";

export interface SlaWorkOrderStatus {
  workOrderId: string;
  workOrderNumber: string;
  responseStatus: SlaBreachLevel;
  resolutionStatus: SlaBreachLevel;
  responseTriggered: boolean;
  resolutionTriggered: boolean;
  escalationsTriggered: number;
}

export interface SlaMonitorCronResult {
  timestamp: string;
  summary: {
    workOrdersScanned: number;
    responseBreaches: number;
    resolutionBreaches: number;
    escalationsDispatched: number;
  };
  details: SlaWorkOrderStatus[];
}

const RESPONSE_BREACH_TYPE = "SLA_RESPONSE_BREACH";
const RESOLUTION_BREACH_TYPE = "SLA_RESOLUTION_BREACH";
const ESCALATION_TYPE_PREFIX = "SLA_ESC_LEVEL_";

const OPEN_STATUSES = [
  "PENDING",
  "ASSIGNED",
  "IN_PROGRESS",
  "ON_HOLD",
] as const;

type OpenWorkOrder = {
  id: string;
  workOrderNumber: string;
  type: string;
  priority: string;
  status: string;
  departmentId: string | null;
  siteId: string | null;
  assignedToId: string | null;
  startedAt: Date | null;
  createdAt: Date;
  title: string;
  tenantId: string | null;
  sla: {
    id: string;
    name: string;
    responseTime: number;
    resolutionTime: number;
    isActive: boolean;
  } | null;
};

/** Engine SLA monitor: hitung breach + trigger escalation idempotent. */
export async function runSlaMonitorCron(
  now = new Date(),
): Promise<SlaMonitorCronResult> {
  const workOrders = await findOpenWorkOrdersWithSla();
  const details: SlaWorkOrderStatus[] = [];
  let responseBreaches = 0;
  let resolutionBreaches = 0;
  let escalationsDispatched = 0;

  for (const wo of workOrders) {
    const status = await processWorkOrder(wo, now);
    if (!status) continue;

    details.push(status);
    if (status.responseTriggered) responseBreaches++;
    if (status.resolutionTriggered) resolutionBreaches++;
    escalationsDispatched += status.escalationsTriggered;
  }

  return {
    timestamp: now.toISOString(),
    summary: {
      workOrdersScanned: workOrders.length,
      responseBreaches,
      resolutionBreaches,
      escalationsDispatched,
    },
    details,
  };
}

async function findOpenWorkOrdersWithSla(): Promise<OpenWorkOrder[]> {
  return prisma.workOrders.findMany({
    where: {
      status: { in: [...OPEN_STATUSES] },
      slaId: { not: null },
    },
    select: {
      id: true,
      workOrderNumber: true,
      type: true,
      priority: true,
      status: true,
      departmentId: true,
      siteId: true,
      assignedToId: true,
      startedAt: true,
      createdAt: true,
      title: true,
      tenantId: true,
      sla: {
        select: {
          id: true,
          name: true,
          responseTime: true,
          resolutionTime: true,
          isActive: true,
        },
      },
    },
  });
}

async function processWorkOrder(
  wo: OpenWorkOrder,
  now: Date,
): Promise<SlaWorkOrderStatus | null> {
  if (!wo.sla || !wo.sla.isActive) return null;

  const elapsedMinutes = diffMinutes(wo.createdAt, now);
  const responseStatus = classify(elapsedMinutes, wo.sla.responseTime);
  const resolutionStatus = classify(elapsedMinutes, wo.sla.resolutionTime);

  const responseTriggered =
    responseStatus === "BREACHED" && !wo.startedAt
      ? await emitOnce(wo, RESPONSE_BREACH_TYPE, buildResponseMessage(wo))
      : false;

  const resolutionTriggered =
    resolutionStatus === "BREACHED"
      ? await emitOnce(wo, RESOLUTION_BREACH_TYPE, buildResolutionMessage(wo))
      : false;

  const escalationsTriggered =
    resolutionStatus === "BREACHED"
      ? await dispatchEscalations(wo, elapsedMinutes)
      : 0;

  return {
    workOrderId: wo.id,
    workOrderNumber: wo.workOrderNumber,
    responseStatus,
    resolutionStatus,
    responseTriggered,
    resolutionTriggered,
    escalationsTriggered,
  };
}

function classify(elapsedMin: number, targetMin: number): SlaBreachLevel {
  if (targetMin <= 0) return "OK";
  if (elapsedMin >= targetMin) return "BREACHED";
  if (elapsedMin >= targetMin * 0.8) return "AT_RISK";
  return "OK";
}

function diffMinutes(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
}

/**
 * Tulis WorkOrderUpdates audit + kirim notifikasi sekali per (WO, updateType).
 * Idempotent: kalau entry untuk updateType ini sudah ada → skip.
 */
async function emitOnce(
  wo: OpenWorkOrder,
  updateType: string,
  message: string,
): Promise<boolean> {
  const existing = await prisma.workOrderUpdates.findFirst({
    where: { workOrderId: wo.id, updateType },
    select: { id: true },
  });

  if (existing) return false;

  try {
    await prisma.workOrderUpdates.create({
      data: {
        id: cryptoRandom(),
        workOrderId: wo.id,
        updateType,
        message,
        tenantId: wo.tenantId,
      },
    });

    await sendWorkOrderReminder(
      {
        id: wo.id,
        workOrderNumber: wo.workOrderNumber,
        title: wo.title,
        type: wo.type,
        priority: wo.priority,
        departmentId: wo.departmentId,
        siteId: wo.siteId,
        assignedToId: wo.assignedToId,
      },
      message,
    );

    return true;
  } catch (error) {
    logger.error(
      `[Cron SLA Monitor] Error emitting ${updateType} for ${wo.workOrderNumber}:`,
      error,
    );
    return false;
  }
}

/**
 * Cari escalation rule yang match SLA / type / priority / department,
 * trigger sekali per level. Hitung berapa level baru di-fire run ini.
 */
async function dispatchEscalations(
  wo: OpenWorkOrder,
  elapsedMinutes: number,
): Promise<number> {
  if (!wo.sla) return 0;

  const escalations = await prisma.workOrderEscalations.findMany({
    where: {
      isActive: true,
      OR: [
        { slaId: wo.sla.id },
        {
          slaId: null,
          AND: [
            {
              OR: [
                { workOrderType: wo.type as never },
                { workOrderType: null },
              ],
            },
            {
              OR: [{ priority: wo.priority as never }, { priority: null }],
            },
            {
              OR: [{ departmentId: wo.departmentId }, { departmentId: null }],
            },
          ],
        },
      ],
    },
    orderBy: { escalationLevel: "asc" },
    select: {
      id: true,
      name: true,
      escalationLevel: true,
      delayMinutes: true,
    },
  });

  let firedCount = 0;
  const breachAge = elapsedMinutes - wo.sla.resolutionTime;

  for (const rule of escalations) {
    if (breachAge < rule.delayMinutes) continue;

    const updateType = `${ESCALATION_TYPE_PREFIX}${rule.escalationLevel}`;
    const message = buildEscalationMessage(wo, rule.name, rule.escalationLevel);
    const fired = await emitOnce(wo, updateType, message);
    if (fired) firedCount++;
  }

  return firedCount;
}

function buildResponseMessage(wo: OpenWorkOrder): string {
  return `🚨 SLA Response Breach! ${wo.workOrderNumber} belum di-respon dalam ${wo.sla?.responseTime} menit (SLA: ${wo.sla?.name})`;
}

function buildResolutionMessage(wo: OpenWorkOrder): string {
  return `🚨 SLA Resolution Breach! ${wo.workOrderNumber} belum selesai dalam ${wo.sla?.resolutionTime} menit (SLA: ${wo.sla?.name})`;
}

function buildEscalationMessage(
  wo: OpenWorkOrder,
  ruleName: string,
  level: number,
): string {
  return `⏫ Escalation Level ${level}: ${ruleName} | ${wo.workOrderNumber} - ${wo.title}`;
}

function cryptoRandom(): string {
  return globalThis.crypto.randomUUID();
}
