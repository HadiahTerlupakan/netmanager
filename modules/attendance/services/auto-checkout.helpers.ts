import { toZonedTime } from "date-fns-tz";
import { logger } from "@/lib/logger";
import { toEndOfDay } from "@/lib/utils/server-datetime";
import {
  addAttendanceAutoCheckoutJob,
  removeFailedAttendanceAutoCheckoutJob,
  type AttendanceAutoCheckoutJobData,
} from "@/lib/event-bus/queues";
import { AttendanceRepository } from "../repositories/AttendanceRepository";
import { getInactiveSessionStatuses } from "../repositories/attendance-repository-helpers";
import { AttendanceSessionPolicyService } from "./AttendanceSessionPolicyService";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

type AttendanceRepositoryInstance = InstanceType<typeof AttendanceRepository>;
type SessionPolicyService = InstanceType<typeof AttendanceSessionPolicyService>;
type OpenAttendance = Awaited<
  ReturnType<AttendanceRepositoryInstance["findAllOpenSessionsWithUser"]>
>[number];
type AutoCheckoutAttendance = NonNullable<
  Awaited<
    ReturnType<AttendanceRepositoryInstance["findOpenSessionForAutoCheckout"]>
  >
>;

export function buildAttendanceAutoCheckoutJobId(attendanceId: string): string {
  return `attendance.auto-checkout.${attendanceId}`;
}

export function getSourceCheckInDate(checkIn: Date): string {
  return checkIn.toISOString().split("T")[0] ?? "";
}

export function buildAutoCheckoutWindow(now: Date, timezone: string) {
  const nowInTz = toZonedTime(now, timezone);
  const endOfToday = new Date(nowInTz);
  endOfToday.setTime(toEndOfDay(endOfToday, timezone).getTime());
  return {
    endOfToday,
    twentyFourHoursAgo: new Date(now.getTime() - DAY_IN_MS),
  };
}

export async function enqueueAttendanceAutoCheckout(input: {
  attendance: OpenAttendance;
  tenantId: string;
  now: Date;
  timezone: string;
  sessionPolicyService: SessionPolicyService;
}) {
  if (isInactiveAttendanceSession(input.attendance)) return false;
  const decision = resolveAutoCheckoutDecision(input.sessionPolicyService, {
    attendance: input.attendance,
    now: input.now,
    timezone: input.timezone,
  });
  if (!decision.shouldAutoCheckout || !decision.autoCheckoutAt) return false;
  await enqueueAutoCheckoutJob(input, decision);
  return true;
}

function isInactiveAttendanceSession(attendance: OpenAttendance) {
  return getInactiveSessionStatuses().includes(attendance.status as never);
}

async function enqueueAutoCheckoutJob(
  input: { attendance: OpenAttendance; tenantId: string },
  decision: { autoCheckoutAt?: Date | null },
) {
  const jobId = buildAttendanceAutoCheckoutJobId(input.attendance.id);
  await removeFailedAttendanceAutoCheckoutJob(jobId);
  await addAttendanceAutoCheckoutJob(
    createAutoCheckoutJobData(input, decision),
    {
      jobId,
    },
  );
}

export async function processAttendanceAutoCheckoutJob(input: {
  attendance: AutoCheckoutAttendance;
  data: AttendanceAutoCheckoutJobData;
  timezone: string;
  attendanceRepo: AttendanceRepositoryInstance;
  sessionPolicyService: SessionPolicyService;
}) {
  const updateData = resolveAutoCheckoutUpdate(input);
  if (!updateData) return createNoopResult(input.attendance.id);
  const updatedCount = await updateAutoCheckoutAttendance(input, updateData);
  return updatedCount === 0
    ? createNoopResult(input.attendance.id)
    : { attendanceId: input.attendance.id, status: "processed" as const };
}

function resolveAutoCheckoutUpdate(input: {
  attendance: AutoCheckoutAttendance;
  data: AttendanceAutoCheckoutJobData;
  timezone: string;
  sessionPolicyService: SessionPolicyService;
}) {
  if (!isAutoCheckoutJobSourceValid(input.attendance, input.data)) return null;
  const updateData = buildAutoCheckoutUpdate(input);
  if (!updateData) return null;
  return isExpectedAutoCheckoutMatched(
    input.data.expectedAutoCheckoutAt,
    updateData.checkOut,
  )
    ? updateData
    : null;
}

function buildAutoCheckoutUpdate(input: {
  attendance: AutoCheckoutAttendance;
  timezone: string;
  sessionPolicyService: SessionPolicyService;
}) {
  const decision = resolveAutoCheckoutDecision(input.sessionPolicyService, {
    attendance: input.attendance,
    now: new Date(),
    timezone: input.timezone,
  });
  return input.sessionPolicyService.buildAutoCheckoutUpdate({
    decision,
    existingNotes: input.attendance.notes ?? null,
  });
}

function updateAutoCheckoutAttendance(
  input: {
    attendance: AutoCheckoutAttendance;
    data: AttendanceAutoCheckoutJobData;
    attendanceRepo: AttendanceRepositoryInstance;
  },
  data: Parameters<
    AttendanceRepositoryInstance["updateOpenSessionForAutoCheckout"]
  >[0]["data"],
) {
  return input.attendanceRepo.updateOpenSessionForAutoCheckout({
    attendanceId: input.attendance.id,
    tenantId: input.data.tenantId,
    data,
  });
}

export function logAutoCheckoutEnqueueError(
  attendanceId: string,
  error: unknown,
) {
  logger.error(
    `[AutoCheckout] Failed to enqueue attendance ${attendanceId}:`,
    error,
  );
}

function resolveAutoCheckoutDecision(
  sessionPolicyService: SessionPolicyService,
  input: {
    attendance: OpenAttendance | AutoCheckoutAttendance;
    now: Date;
    timezone: string;
  },
) {
  return sessionPolicyService.resolve({
    attendance: mapPolicyAttendance(input.attendance),
    now: input.now,
    scheduleEndTime: getScheduleEndTime(input.attendance.user),
    timezone: input.timezone,
  });
}

function mapPolicyAttendance(
  attendance: OpenAttendance | AutoCheckoutAttendance,
) {
  return {
    id: attendance.id,
    checkIn: attendance.checkIn,
    checkOut: attendance.checkOut,
    status: attendance.status,
    user: {
      workingHourMode: attendance.user.workingHourMode as
        | "FIXED"
        | "SHIFT"
        | "FLEXIBLE"
        | null,
      flexibleTargetHour: null as number | null,
      shift: attendance.user.shift
        ? {
            startTime: attendance.user.shift.startTime,
            endTime: attendance.user.shift.endTime,
          }
        : null,
    },
  };
}

function getScheduleEndTime(
  user: OpenAttendance["user"] | AutoCheckoutAttendance["user"],
) {
  return user.workingHourMode === "SHIFT" && user.shift
    ? user.shift.endTime
    : user.endWorkTime;
}

function createAutoCheckoutJobData(
  input: { attendance: OpenAttendance; tenantId: string },
  decision: { autoCheckoutAt?: Date | null },
) {
  return {
    attendanceId: input.attendance.id,
    tenantId: input.tenantId,
    mode: input.attendance.user.workingHourMode as
      | "FIXED"
      | "SHIFT"
      | "FLEXIBLE"
      | null,
    expectedAutoCheckoutAt: decision.autoCheckoutAt!.toISOString(),
    sourceCheckInDate: getSourceCheckInDate(input.attendance.checkIn),
  };
}

function isAutoCheckoutJobSourceValid(
  attendance: AutoCheckoutAttendance,
  data: AttendanceAutoCheckoutJobData,
) {
  return (
    getSourceCheckInDate(attendance.checkIn) === data.sourceCheckInDate &&
    attendance.user.workingHourMode === data.mode
  );
}

function isExpectedAutoCheckoutMatched(
  payloadExpectedAutoCheckoutAt: string,
  resolvedAutoCheckoutAt: Date,
): boolean {
  const expectedAutoCheckoutAt = new Date(payloadExpectedAutoCheckoutAt);
  if (Number.isNaN(expectedAutoCheckoutAt.getTime())) return false;
  return expectedAutoCheckoutAt.getTime() === resolvedAutoCheckoutAt.getTime();
}

function createNoopResult(attendanceId: string) {
  return { attendanceId, status: "noop" as const };
}
