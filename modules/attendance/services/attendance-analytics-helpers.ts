import { AttendanceStatus } from "../types/attendance.enums";
import type { AttendanceRepository } from "../repositories/AttendanceRepository";
import type { UserLookupService } from "@/modules/users";

type AnalyticsAttendance = {
  checkIn: Date;
  checkOut: Date | null;
  status: AttendanceStatus;
};

/** Bangun analytics absensi user untuk rentang hari tertentu. */
export async function getAttendanceAnalytics(input: {
  userId: string;
  days: number;
  attendanceRepo: AttendanceRepository;
  userRepo: UserLookupService;
}) {
  const period = buildAnalyticsPeriod(input.days);
  const userAttendances = await findAnalyticsAttendances(input, period);
  return {
    stats: buildAnalyticsStats(userAttendances),
    weeklyBreakdown: buildWeeklyBreakdown(period.startDate, userAttendances),
    recentAttendance: userAttendances.slice(0, 10),
    period,
  };
}

function buildAnalyticsPeriod(days: number) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  return { startDate, endDate: new Date(), days };
}

async function findAnalyticsAttendances(
  input: {
    userId: string;
    attendanceRepo: AttendanceRepository;
    userRepo: UserLookupService;
  },
  period: { startDate: Date; endDate: Date },
) {
  const userDetails = await input.userRepo.findAttendanceSettingsById(
    input.userId,
  );
  const attendances = await input.attendanceRepo.findManyForAnalytics({
    userId: input.userId,
    startDate: period.startDate,
    endDate: period.endDate,
  });
  return attendances.filter(
    (attendance) =>
      !userDetails?.joinDate || attendance.checkIn >= userDetails.joinDate,
  );
}

function buildAnalyticsStats(userAttendances: AnalyticsAttendance[]) {
  const totalDays = userAttendances.length;
  const onTimeDays = userAttendances.filter(
    (attendance) => attendance.status === "ON_TIME",
  ).length;
  const lateDays = userAttendances.filter(
    (attendance) => attendance.status === "LATE",
  ).length;
  const totalMinutes = userAttendances.reduce(sumAttendanceMinutes, 0);
  return {
    totalDays,
    onTimeDays,
    lateDays,
    totalWorkHours: totalMinutes / 60,
    avgWorkHours: totalDays > 0 ? totalMinutes / 60 / totalDays : 0,
    onTimeRate: totalDays > 0 ? (onTimeDays / totalDays) * 100 : 0,
    lateRate: totalDays > 0 ? (lateDays / totalDays) * 100 : 0,
  };
}

function buildWeeklyBreakdown(
  startDate: Date,
  userAttendances: AnalyticsAttendance[],
) {
  return Array.from({ length: 4 }, (_, index) => {
    const weekStart = new Date(startDate);
    weekStart.setDate(weekStart.getDate() + index * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekAttendances = filterWeeklyAttendance(
      weekStart,
      weekEnd,
      userAttendances,
    );
    return {
      week: index + 1,
      startDate: weekStart,
      endDate: weekEnd,
      ...buildWeekBreakdown(weekAttendances),
    };
  });
}

function sumAttendanceMinutes(
  total: number,
  attendance: { checkIn: Date; checkOut: Date | null },
) {
  if (!attendance.checkOut) return total;
  return (
    total +
    (new Date(attendance.checkOut).getTime() -
      new Date(attendance.checkIn).getTime()) /
      (1000 * 60)
  );
}

function filterWeeklyAttendance(
  start: Date,
  end: Date,
  attendances: Array<{ checkIn: Date; status: AttendanceStatus }>,
) {
  return attendances.filter((attendance) => {
    const checkIn = new Date(attendance.checkIn);
    return checkIn >= start && checkIn < end;
  });
}

function buildWeekBreakdown(
  weekAttendances: Array<{ status: AttendanceStatus }>,
) {
  return {
    totalDays: weekAttendances.length,
    onTimeDays: weekAttendances.filter(
      (attendance) => attendance.status === "ON_TIME",
    ).length,
    lateDays: weekAttendances.filter(
      (attendance) => attendance.status === "LATE",
    ).length,
  };
}
