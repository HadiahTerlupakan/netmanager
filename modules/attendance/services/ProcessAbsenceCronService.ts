import { logger } from "@/lib/logger";
import { prisma } from "@/modules/database";
import {
  acquireCronLock,
  CRON_LOCK_UNAVAILABLE_MESSAGE,
} from "@/lib/cron-lock";
import { AbsenceService } from "./AbsenceService";

const PROCESS_ABSENCE_LOCK_SECONDS = 60 * 60;

export type ProcessAbsenceCronResult =
  | {
      status: "processed";
      payload: ProcessAbsenceSuccessPayload;
    }
  | {
      status: "locked";
      payload: ProcessAbsenceLockedPayload;
    }
  | {
      status: "unavailable";
      payload: ProcessAbsenceUnavailablePayload;
    };

type ProcessAbsenceSuccessPayload = {
  success: true;
  date: string;
  tenantsProcessed: number;
  results: Array<Record<string, unknown> & { tenantId: string }>;
};

type ProcessAbsenceLockedPayload = {
  success: true;
  skipped: true;
  reason: "Lock already held";
};

type ProcessAbsenceUnavailablePayload = {
  success: false;
  error: typeof CRON_LOCK_UNAVAILABLE_MESSAGE;
};

/** Runs absence processing with cron locking for a target date. */
export async function runProcessAbsenceCron(options: {
  targetDate: Date;
}): Promise<ProcessAbsenceCronResult> {
  const lockResult = await acquireProcessAbsenceLock(options.targetDate);
  if (lockResult === "unavailable") return buildUnavailableResult();
  if (lockResult === "locked") return buildLockedResult();
  return {
    status: "processed",
    payload: await processAbsenceForActiveTenants(options.targetDate),
  };
}

function acquireProcessAbsenceLock(targetDate: Date) {
  return acquireCronLock(
    `processAbsence:${getDateLockKey(targetDate)}`,
    PROCESS_ABSENCE_LOCK_SECONDS,
  );
}

function buildUnavailableResult(): ProcessAbsenceCronResult {
  return {
    status: "unavailable",
    payload: { success: false, error: CRON_LOCK_UNAVAILABLE_MESSAGE },
  };
}

function buildLockedResult(): ProcessAbsenceCronResult {
  return {
    status: "locked",
    payload: { success: true, skipped: true, reason: "Lock already held" },
  };
}

export function getDefaultProcessAbsenceDate(now = new Date()) {
  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() - 1);
  return targetDate;
}

function getDateLockKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function processAbsenceForActiveTenants(targetDate: Date) {
  const tenants = await findActiveTenantIds();
  const results = await processAbsenceTenants(tenants, targetDate);
  return buildProcessAbsencePayload(targetDate, results);
}

function findActiveTenantIds() {
  return prisma.tenant.findMany({
    where: { isActive: true },
    select: { id: true },
  });
}

async function processAbsenceTenants(
  tenants: Array<{ id: string }>,
  targetDate: Date,
) {
  const absenceService = new AbsenceService();
  const processed = await Promise.all(
    tenants.map((tenant) =>
      processTenantAbsence(absenceService, tenant.id, targetDate),
    ),
  );
  return processed.filter(Boolean) as ProcessAbsenceSuccessPayload["results"];
}

async function processTenantAbsence(
  absenceService: AbsenceService,
  tenantId: string,
  targetDate: Date,
) {
  try {
    const result = await absenceService.processDailyAbsence(
      targetDate,
      tenantId,
    );
    return { tenantId, ...result };
  } catch (error) {
    logger.error(`[Cron] Error for tenant ${tenantId}:`, error);
    return null;
  }
}

function buildProcessAbsencePayload(
  targetDate: Date,
  results: ProcessAbsenceSuccessPayload["results"],
) {
  return {
    success: true as const,
    date: targetDate.toISOString().split("T")[0],
    tenantsProcessed: results.length,
    results,
  };
}
