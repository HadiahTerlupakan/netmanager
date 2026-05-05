import { toStartOfDay } from "@/lib/utils/server-datetime";

const MINUTES_PER_MILLISECOND = 1000 * 60;
const HOURS_BACK_FOR_ADMIN_KPI = 30;
const MAX_TREND_MONTHS = 24;
const TYPE_LABELS: Record<string, string> = {
  INSTALLATION: "Pemasangan",
  REPAIR: "Perbaikan",
  MAINTENANCE: "Maintenance",
  INSPECTION: "Inspeksi",
  DISCONNECTION: "Cabut Perangkat",
  RELOCATION: "Relokasi",
  UPGRADE: "Upgrade",
  OTHER: "Lainnya",
};
const EMPTY_PERFORMANCE_MONTH = {
  totalHours: 0,
  totalRating: 0,
  ratingCount: 0,
  count: 0,
};

type UserKPIStats = {
  name: string;
  role: string;
  totalResponseTime: number;
  responseCount: number;
  verifiedCount: number;
  totalVerifyTime: number;
  completedCount: number;
  canvasingCount?: number;
  totalCanvasingTime?: number;
  isTechnical?: boolean;
};

/** Build base filter object for optional department/site analytics queries. */
export function buildAnalyticsWhere(params: {
  departmentId?: string;
  siteId?: string;
}) {
  return {
    ...(params.departmentId ? { departmentId: params.departmentId } : {}),
    ...(params.siteId ? { siteId: params.siteId } : {}),
  };
}

/** Return trend month keys between start and end dates. */
export function buildMonthKeys(startDate: Date, endDate: Date): string[] {
  const monthDiff =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth()) +
    1;
  const monthCount = Math.max(1, Math.min(monthDiff, MAX_TREND_MONTHS));

  return Array.from({ length: monthCount }, (_, index) =>
    formatMonthKey(
      new Date(startDate.getFullYear(), startDate.getMonth() + index, 1),
    ),
  );
}

/** Create localized month label from month key. */
export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const date = new Date(parseInt(year || "0"), parseInt(month || "1") - 1, 1);

  return date.toLocaleDateString("id-ID", {
    month: "short",
    year: "numeric",
  });
}

/** Calculate positive duration in minutes. */
export function calculateMinutesBetween(
  startDate: Date,
  endDate: Date,
): number {
  return (endDate.getTime() - startDate.getTime()) / MINUTES_PER_MILLISECOND;
}

/** Create default KPI stats object for a user. */
export function createInitialUserKPIStats(params: {
  name?: string | null;
  role?: string | null;
  isTechnical?: boolean;
}): UserKPIStats {
  return {
    name: params.name || "Unknown",
    role: params.role || "N/A",
    isTechnical: params.isTechnical || false,
    totalResponseTime: 0,
    responseCount: 0,
    verifiedCount: 0,
    totalVerifyTime: 0,
    completedCount: 0,
  };
}

/** Ensure canvasing counters exist on KPI stats. */
export function ensureCanvasingStats(stat: UserKPIStats): UserKPIStats {
  return {
    ...stat,
    canvasingCount: stat.canvasingCount ?? 0,
    totalCanvasingTime: stat.totalCanvasingTime ?? 0,
  };
}

/** Create fallback KPI stats for sales-only admin users. */
export function createFallbackSalesKPIStats(): UserKPIStats {
  return {
    name: "Admin (Sales)",
    role: "N/A",
    totalResponseTime: 0,
    responseCount: 0,
    verifiedCount: 0,
    totalVerifyTime: 0,
    completedCount: 0,
    canvasingCount: 0,
    totalCanvasingTime: 0,
  };
}

/** Calculate KPI score with weighted metrics. */
export function calculateAdminScore(stat: UserKPIStats): number {
  return (
    stat.completedCount * 5 +
    stat.verifiedCount * 3 +
    (stat.canvasingCount || 0) * 2 +
    stat.responseCount
  );
}

/** Calculate rounded average or return zero. */
export function calculateRoundedAverage(total: number, count: number): number {
  return count > 0 ? Math.round(total / count) : 0;
}

/** Hitung rata-rata menit verifikasi work order. */
export function calculateAverageVerificationMinutes(
  verifiedWorkOrders: Array<{
    completedAt: Date | null;
    verifiedAt: Date | null;
  }>,
) {
  const totalMinutes = verifiedWorkOrders.reduce((sum, workOrder) => {
    if (!workOrder.completedAt || !workOrder.verifiedAt) return sum;
    return (
      sum + calculateMinutesBetween(workOrder.completedAt, workOrder.verifiedAt)
    );
  }, 0);

  return calculateRoundedAverage(totalMinutes, verifiedWorkOrders.length);
}

/** Hitung rata-rata menit approval canvasing. */
export function calculateAverageCanvasingMinutes(
  approvedCanvasing: Array<{ createdAt: Date; approvedAt: Date | null }>,
) {
  const totalMinutes = approvedCanvasing.reduce((sum, canvasing) => {
    if (!canvasing.approvedAt) return sum;
    return (
      sum + calculateMinutesBetween(canvasing.createdAt, canvasing.approvedAt)
    );
  }, 0);

  return calculateRoundedAverage(totalMinutes, approvedCanvasing.length);
}

/** Return current KPI date boundaries. */
export function buildAdminKpiDates(now = new Date()) {
  const today = new Date();
  today.setTime(toStartOfDay(now).getTime());

  const dateTo = new Date();
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - HOURS_BACK_FOR_ADMIN_KPI);

  return { today, dateFrom, dateTo };
}

/** Return start of current week based on provided day. */
export function buildStartOfWeek(today: Date) {
  const startOfWeek = new Date(today);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  return startOfWeek;
}

/** Map work order type code into display label. */
export function mapWorkOrderTypeLabel(type: string): string {
  return TYPE_LABELS[type] || type;
}

/** Build empty volume trend month map. */
export function createVolumeMonthMap(monthKeys: string[]) {
  return Object.fromEntries(
    monthKeys.map((monthKey) => [
      monthKey,
      { created: 0, completed: 0, requested: 0 },
    ]),
  ) as Record<
    string,
    { created: number; completed: number; requested: number }
  >;
}

/** Build empty issue trend month map. */
export function createIssueMonthMap(monthKeys: string[]) {
  return Object.fromEntries(
    monthKeys.map((monthKey) => [monthKey, {}]),
  ) as Record<string, Record<string, number>>;
}

/** Build empty performance trend month map. */
export function createPerformanceMonthMap(monthKeys: string[]) {
  return Object.fromEntries(
    monthKeys.map((monthKey) => [monthKey, { ...EMPTY_PERFORMANCE_MONTH }]),
  ) as Record<string, typeof EMPTY_PERFORMANCE_MONTH>;
}

/** Build empty type trend month map. */
export function createTypeMonthMap(monthKeys: string[]) {
  return Object.fromEntries(
    monthKeys.map((monthKey) => [monthKey, {}]),
  ) as Record<string, Record<string, number>>;
}

/** Format month key from date. */
export function formatMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
