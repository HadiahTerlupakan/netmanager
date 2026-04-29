import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";
import { AbsenceService } from "./AbsenceService";
import { LeaveService } from "./LeaveService";
import type { AttendanceFilterInput } from "./AdminAttendanceTypes";

/** Sinkronkan leave/day-off sebelum data attendance admin dibaca. */
export async function syncAttendanceDependencies(
  input: AttendanceFilterInput,
  timezone: string,
  tenantId: string,
) {
  if (!input.startDate) return;
  const rangeStart = toStartOfDay(input.startDate, timezone);
  const rangeEnd = toEndOfDay(input.endDate ?? input.startDate, timezone);
  const leaveService = new LeaveService();
  const absenceService = new AbsenceService();

  await leaveService.syncApprovedLeaveToAttendanceRange(
    rangeStart,
    rangeEnd,
    tenantId,
    input.userId,
  );
  await absenceService.syncDayOffAttendanceRange(
    rangeStart,
    rangeEnd,
    tenantId,
    input.userId,
  );
}
