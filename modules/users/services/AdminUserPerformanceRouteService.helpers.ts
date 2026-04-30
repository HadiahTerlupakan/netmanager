import { Prisma } from "@prisma/client";
import { toStartOfDay } from "@/lib/utils/server-datetime";

const DEFAULT_CANVASING_TARGET = 50;
const MINUTES_PER_HOUR = 60;
const ROUNDING_PRECISION = 10;
const COMPLETED_WORK_ORDER_STATUSES = [
  "COMPLETED",
  "VERIFIED",
  "CLOSED",
] as const;

export type UserPerformancePeriod = {
  startDate: Date;
  endDate: Date;
};

export type SalesPeriod = "day" | "week" | "month" | "all";

/** Membulatkan angka ke satu digit desimal. */
export function roundSingleDecimal(value: number) {
  return Math.round(value * ROUNDING_PRECISION) / ROUNDING_PRECISION;
}

/** Membangun rentang periode penjualan berdasarkan filter singkat. */
export function buildSalesPeriodRange(period: SalesPeriod) {
  const now = new Date();
  const endDate = buildEndOfToday(now);

  if (period === "day") {
    return { startDate: buildStartOfToday(now), endDate };
  }

  if (period === "week") {
    return { startDate: buildStartOfWeek(now), endDate };
  }

  if (period === "month") {
    return {
      startDate: new Date(now.getFullYear(), now.getMonth(), 1),
      endDate,
    };
  }

  return { startDate: new Date(0), endDate };
}

/** Membangun rentang performa dari parameter query admin. */
export function buildPerformancePeriod(params: {
  dateFrom?: string | null;
  dateTo?: string | null;
  period?: string | null;
}): UserPerformancePeriod {
  if (params.dateFrom && params.dateTo) {
    return buildExplicitPerformancePeriod(params.dateFrom, params.dateTo);
  }

  if (params.period === "month") {
    return buildCurrentMonthPerformancePeriod();
  }

  return { startDate: new Date(0), endDate: new Date() };
}

/** Membuat statistik kehadiran kosong. */
export function createEmptyAttendanceStats() {
  return { present: 0, late: 0, absent: 0, alpha: 0, total: 0 };
}

/** Mengisi statistik kehadiran dari hasil groupBy Prisma. */
export function mapAttendanceStats(
  attendanceStats: Array<{ status: string; _count: { _all: number } }>,
) {
  const attendance = createEmptyAttendanceStats();

  attendanceStats.forEach((stat) => {
    const count = stat._count._all || 0;
    if (stat.status === "ON_TIME") attendance.present += count;
    else if (stat.status === "LATE") attendance.late += count;
    else if (stat.status === "ABSENT" || stat.status === "DAY_OFF") {
      attendance.absent += count;
    } else if (stat.status === "ALPHA") {
      attendance.alpha += count;
    }
  });

  attendance.total =
    attendance.present + attendance.late + attendance.absent + attendance.alpha;
  return attendance;
}

/** Membuat statistik kerja fleksibel kosong. */
export function createEmptyFlexibleStats(flexibleTargetHour: number) {
  return {
    totalMinutesThisMonth: 0,
    totalHoursThisMonth: 0,
    daysWorkedThisMonth: 0,
    avgHoursPerDay: 0,
    targetHoursPerDay: flexibleTargetHour,
    targetPercentage: 0,
  };
}

/** Menghitung statistik kerja fleksibel dari total menit kerja. */
export function buildFlexibleStats(
  totalMinutes: number,
  daysWorked: number,
  flexibleTargetHour: number,
) {
  const avgHoursPerDay =
    daysWorked > 0 ? totalMinutes / daysWorked / MINUTES_PER_HOUR : 0;
  const targetPercentage =
    flexibleTargetHour > 0
      ? Math.round((avgHoursPerDay / flexibleTargetHour) * 100)
      : 0;

  return {
    totalMinutesThisMonth: Math.round(totalMinutes),
    totalHoursThisMonth: roundSingleDecimal(totalMinutes / MINUTES_PER_HOUR),
    daysWorkedThisMonth: daysWorked,
    avgHoursPerDay: roundSingleDecimal(avgHoursPerDay),
    targetHoursPerDay: flexibleTargetHour,
    targetPercentage: Math.min(targetPercentage, 100),
  };
}

/** Membuat statistik cuti kosong. */
export function createEmptyLeaveStats() {
  return {
    cuti: 0,
    sakit: 0,
    izin: 0,
    lainnya: 0,
    tukarLibur: 0,
    total: 0,
  };
}

/** Mengisi statistik cuti dari hasil groupBy Prisma. */
export function mapLeaveStats(
  leaveStats: Array<{ type: string; _count: { _all: number } }>,
) {
  const leaves = createEmptyLeaveStats();

  leaveStats.forEach((stat) => {
    const count = stat._count._all || 0;
    leaves.total += count;
    if (stat.type === "CUTI") leaves.cuti = count;
    else if (stat.type === "SAKIT") leaves.sakit = count;
    else if (stat.type === "IZIN") leaves.izin = count;
    else if (stat.type === "LAINNYA") leaves.lainnya = count;
    else if (stat.type === "TUKAR_LIBUR") leaves.tukarLibur = count;
  });

  return leaves;
}

/** Membangun filter tanggal work order untuk query performa. */
export function buildWorkOrderDateFilter(period: UserPerformancePeriod) {
  return { createdAt: { gte: period.startDate, lte: period.endDate } };
}

/** Membangun filter work order saat user menjadi lead. */
export function buildLeadWorkOrderWhere(
  userId: string,
  period: UserPerformancePeriod,
) {
  return { assignedToId: userId, ...buildWorkOrderDateFilter(period) };
}

/** Membangun filter work order saat user menjadi support. */
export function buildSupportWorkOrderWhere(
  userId: string,
  period: UserPerformancePeriod,
) {
  return {
    assignedToId: { not: userId },
    assignments: { some: { userId } },
    ...buildWorkOrderDateFilter(period),
  };
}

/** Membangun filter agregasi work order keseluruhan. */
export function buildOverallWorkOrderWhere(
  userId: string,
  period: UserPerformancePeriod,
): Prisma.WorkOrdersWhereInput {
  return {
    OR: [{ assignedToId: userId }, { assignments: { some: { userId } } }],
    ...buildWorkOrderDateFilter(period),
  };
}

/** Membuat payload statistik work order akhir. */
export function buildWorkOrderStats(
  leadTotal: number,
  leadCompleted: number,
  supportTotal: number,
  supportCompleted: number,
  averageRating: number | null | undefined,
) {
  const totalAssigned = leadTotal + supportTotal;
  const completed = leadCompleted + supportCompleted;

  return {
    totalAssigned,
    completed,
    lead: { total: leadTotal, completed: leadCompleted },
    support: { total: supportTotal, completed: supportCompleted },
    completionRate:
      totalAssigned > 0 ? Math.round((completed / totalAssigned) * 100) : 0,
    avgRating: averageRating ? Number(averageRating.toFixed(1)) : 0,
  };
}

/** Membuat statistik canvasing kosong. */
export function createEmptyCanvasingStats() {
  return { approved: 0, rejected: 0, pending: 0, total: 0 };
}

/** Mengisi statistik canvasing dari hasil groupBy Prisma. */
export function mapCanvasingStats(
  canvasingStats: Array<{ status: string; _count: { _all: number } }>,
) {
  const canvasing = createEmptyCanvasingStats();

  canvasingStats.forEach((stat) => {
    const count = stat._count._all || 0;
    canvasing.total += count;
    if (stat.status === "APPROVED") canvasing.approved = count;
    else if (stat.status === "REJECTED") canvasing.rejected = count;
    else if (stat.status === "PENDING") canvasing.pending = count;
  });

  return canvasing;
}

/** Membuat statistik point claim kosong. */
export function createEmptyPointStats() {
  return {
    approved: 0,
    approvedValue: 0,
    rejected: 0,
    pending: 0,
    pendingValue: 0,
    total: 0,
    totalValue: 0,
  };
}

/** Mengisi statistik point claim dari hasil groupBy Prisma. */
export function mapPointStats(
  pointClaimStats: Array<{
    status: string;
    _count: { _all: number };
    _sum: { pointValue: number | null };
  }>,
) {
  const points = createEmptyPointStats();

  pointClaimStats.forEach((stat) => {
    const count = stat._count._all || 0;
    const value = stat._sum.pointValue || 0;
    points.total += count;
    points.totalValue += value;
    if (stat.status === "APPROVED") {
      points.approved = count;
      points.approvedValue = value;
    } else if (stat.status === "REJECTED") {
      points.rejected = count;
    } else if (stat.status === "PENDING") {
      points.pending = count;
      points.pendingValue = value;
    }
  });

  return points;
}

/** Membangun ringkasan performa sales untuk route admin. */
export function buildSalesPerformanceSummary(input: {
  user: { id: string; name: string | null; canvasingTarget: number | null };
  period: SalesPeriod;
  canvasing: ReturnType<typeof mapCanvasingStats>;
  points: ReturnType<typeof mapPointStats>;
  totalAllTime: number;
  totalPointsAllTime: number;
  recentActivityRaw: Array<{
    id: string;
    nama: string | null;
    status: string;
    createdAt: Date;
    alamat: string | null;
    pointClaims: unknown;
  }>;
}) {
  const target = input.user.canvasingTarget || DEFAULT_CANVASING_TARGET;

  return {
    user: input.user,
    period: input.period,
    target,
    canvasing: {
      ...input.canvasing,
      progress: Math.round((input.canvasing.approved / target) * 100),
    },
    points: input.points,
    totalAllTime: input.totalAllTime,
    totalPointsAllTime: input.totalPointsAllTime,
    recentActivity: input.recentActivityRaw.map((activity) => ({
      id: activity.id,
      pelangganName: activity.nama,
      status: activity.status,
      createdAt: activity.createdAt,
      address: activity.alamat,
      pointClaim: activity.pointClaims || null,
    })),
  };
}

/** Menyediakan status work order yang dianggap selesai. */
export function getCompletedWorkOrderStatuses() {
  return [...COMPLETED_WORK_ORDER_STATUSES];
}

function buildEndOfToday(now: Date) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
}

function buildStartOfToday(now: Date) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function buildStartOfWeek(now: Date) {
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - startDate.getDay() + 1);
  startDate.setTime(toStartOfDay(startDate).getTime());
  return startDate;
}

function buildExplicitPerformancePeriod(dateFrom: string, dateTo: string) {
  const startDate = new Date(dateFrom);
  const endDate = new Date(dateTo);
  endDate.setHours(23, 59, 59, 999);
  return { startDate, endDate };
}

function buildCurrentMonthPerformancePeriod(): UserPerformancePeriod {
  const startDate = new Date();
  startDate.setDate(1);
  startDate.setTime(toStartOfDay(startDate).getTime());
  return { startDate, endDate: new Date() };
}
