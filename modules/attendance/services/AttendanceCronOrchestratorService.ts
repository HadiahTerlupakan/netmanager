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
  const currentMinute = now.getMinutes();
  const currentHour = now.getHours();
  const jobs: AttendanceCronJobName[] = ["auto-checkout"];

  if (shouldRunAutoAlert(currentMinute)) {
    jobs.unshift("attendance-alert:auto");
  }

  if (isHourlyJobTime(currentMinute, currentHour, 22)) {
    jobs.unshift("attendance-alert:process");
  }

  if (isHourlyJobTime(currentMinute, currentHour, 1)) {
    jobs.unshift("process-absence");
  }

  return jobs;
}

/** Tentukan apakah reminder auto attendance perlu dijalankan. */
function shouldRunAutoAlert(minute: number): boolean {
  return minute % 15 === 0;
}

/** Tentukan apakah job terjadwal berjalan pada jam tertentu. */
function isHourlyJobTime(
  minute: number,
  hour: number,
  scheduledHour: number,
): boolean {
  return minute === 0 && hour === scheduledHour;
}

async function runProcessAbsence(now: Date) {
  const targetDate = getPreviousDate(now);
  const tenants = await findActiveTenants();
  const results = await processTenantAbsences(tenants, targetDate);
  return buildProcessAbsenceResult(targetDate, results);
}

function getPreviousDate(now: Date) {
  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() - 1);
  return targetDate;
}

async function findActiveTenants() {
  return prisma.tenant.findMany({
    where: { isActive: true },
    select: { id: true },
  });
}

async function processTenantAbsences(
  tenants: Array<{ id: string }>,
  targetDate: Date,
) {
  const absenceService = new AbsenceService();
  return Promise.all(
    tenants.map(async (tenant) => ({
      tenantId: tenant.id,
      ...(await absenceService.processDailyAbsence(targetDate, tenant.id)),
    })),
  );
}

function buildProcessAbsenceResult(
  targetDate: Date,
  results: Array<Record<string, unknown>>,
) {
  return {
    date: targetDate.toISOString().split("T")[0],
    tenantsProcessed: results.length,
    results,
  };
}

async function runAttendanceCronJob(jobName: AttendanceCronJobName, now: Date) {
  if (jobName === "attendance-alert:auto") return runScheduledAttendanceCheck();
  if (jobName === "attendance-alert:process")
    return processIncompleteAttendance();
  if (jobName === "process-absence") return runProcessAbsence(now);
  return AutoCheckoutService.runAutoCheckout();
}

export async function runAttendanceCronOrchestrator(options?: { now?: Date }) {
  const now = options?.now ?? new Date();
  const jobs = await Promise.all(
    getDueAttendanceCronJobs(now).map(async (name) => ({
      name,
      result: await runAttendanceCronJob(name, now),
    })),
  );

  return { now: now.toISOString(), jobs };
}
