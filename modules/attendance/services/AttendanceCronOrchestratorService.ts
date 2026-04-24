import {
  processIncompleteAttendance,
  runScheduledAttendanceCheck,
} from "./AttendanceAlertService";
import { AutoCheckoutService } from "./AutoCheckoutService";
import { AbsenceService } from "./AbsenceService";
import { prisma } from "@/modules/database";

export type AttendanceCronJobName =
  | "attendance-alert:auto"
  | "attendance-alert:process"
  | "process-absence"
  | "auto-checkout";

export function getDueAttendanceCronJobs(now: Date): AttendanceCronJobName[] {
  const jobs: AttendanceCronJobName[] = [];
  const minute = now.getMinutes();
  const hour = now.getHours();

  if (minute % 15 === 0) {
    jobs.push("attendance-alert:auto");
  }

  if (minute === 0 && hour === 22) {
    jobs.push("attendance-alert:process");
  }

  if (minute === 0 && hour === 1) {
    jobs.push("process-absence");
  }

  jobs.push("auto-checkout");

  return jobs;
}

async function runProcessAbsence(now: Date) {
  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() - 1);

  const tenants = await prisma.tenant.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  const absenceService = new AbsenceService();
  const results = [];

  for (const tenant of tenants) {
    const result = await absenceService.processDailyAbsence(
      targetDate,
      tenant.id,
    );
    results.push({ tenantId: tenant.id, ...result });
  }

  return {
    date: targetDate.toISOString().split("T")[0],
    tenantsProcessed: results.length,
    results,
  };
}

export async function runAttendanceCronOrchestrator(options?: { now?: Date }) {
  const now = options?.now ?? new Date();
  const dueJobs = getDueAttendanceCronJobs(now);
  const jobs = [];

  for (const jobName of dueJobs) {
    if (jobName === "attendance-alert:auto") {
      jobs.push({ name: jobName, result: await runScheduledAttendanceCheck() });
      continue;
    }

    if (jobName === "attendance-alert:process") {
      jobs.push({ name: jobName, result: await processIncompleteAttendance() });
      continue;
    }

    if (jobName === "process-absence") {
      jobs.push({ name: jobName, result: await runProcessAbsence(now) });
      continue;
    }

    jobs.push({
      name: jobName,
      result: await AutoCheckoutService.runAutoCheckout(),
    });
  }

  return {
    now: now.toISOString(),
    jobs,
  };
}
