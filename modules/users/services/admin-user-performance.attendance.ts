import { prisma } from "@/modules/database";

import {
  buildFlexibleStats,
  createEmptyFlexibleStats,
  mapAttendanceStats,
  mapLeaveStats,
  type UserPerformancePeriod,
} from "./AdminUserPerformanceRouteService.helpers";

/** Ambil statistik kehadiran terkelompok dalam rentang tanggal. */
export async function getAttendanceStats(
  userId: string,
  period: UserPerformancePeriod,
) {
  const attendanceStats = await prisma.attendance.groupBy({
    by: ["status"],
    where: {
      userId,
      checkIn: { gte: period.startDate, lte: period.endDate },
    },
    _count: { _all: true },
  });

  return mapAttendanceStats(
    attendanceStats as Array<{ status: string; _count: { _all: number } }>,
  );
}

/** Ambil statistik jam kerja fleksibel. */
export async function getFlexibleStats(input: {
  userId: string;
  workingHourMode: string;
  flexibleTargetHour: number;
  period: UserPerformancePeriod;
}) {
  if (input.workingHourMode !== "FLEXIBLE") {
    return createEmptyFlexibleStats(input.flexibleTargetHour);
  }

  const attendances = await prisma.attendance.findMany({
    where: {
      userId: input.userId,
      checkIn: { gte: input.period.startDate, lte: input.period.endDate },
      checkOut: { not: null },
    },
    select: { checkIn: true, checkOut: true },
  });
  const totalMinutes = attendances.reduce(
    (sum, item) =>
      sum + (item.checkOut!.getTime() - item.checkIn.getTime()) / (1000 * 60),
    0,
  );

  return buildFlexibleStats(
    totalMinutes,
    attendances.length,
    input.flexibleTargetHour,
  );
}

/** Ambil statistik cuti yang sudah disetujui. */
export async function getLeaveStats(
  userId: string,
  period: UserPerformancePeriod,
) {
  const leaveStats = await prisma.leaveRequest.groupBy({
    by: ["type"],
    where: {
      userId,
      status: "APPROVED",
      startDate: { gte: period.startDate, lte: period.endDate },
    },
    _count: { _all: true },
  });

  return mapLeaveStats(
    leaveStats as Array<{ type: string; _count: { _all: number } }>,
  );
}
