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
  const lockResult = await acquireCronLock(
    `processAbsence:${getDateLockKey(options.targetDate)}`,
    PROCESS_ABSENCE_LOCK_SECONDS,
  );

  if (lockResult === "unavailable") {
    return {
      status: "unavailable",
      payload: { success: false, error: CRON_LOCK_UNAVAILABLE_MESSAGE },
    };
  }

  if (lockResult === "locked") {
    return {
      status: "locked",
      payload: { success: true, skipped: true, reason: "Lock already held" },
    };
  }

  return {
    status: "processed",
    payload: await processAbsenceForActiveTenants(options.targetDate),
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
  const absenceService = new AbsenceService();
  const tenants = await prisma.tenant.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  const results: ProcessAbsenceSuccessPayload["results"] = [];

  for (const tenant of tenants) {
    try {
      const result = await absenceService.processDailyAbsence(
        targetDate,
        tenant.id,
      );
      results.push({ tenantId: tenant.id, ...result });
    } catch (error) {
      console.error(`[Cron] Error for tenant ${tenant.id}:`, error);
    }
  }

  return {
    success: true as const,
    date: targetDate.toISOString().split("T")[0],
    tenantsProcessed: results.length,
    results,
  };
}
