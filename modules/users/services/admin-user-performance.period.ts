import { toStartOfDay } from "@/lib/utils/server-datetime";

export type UserPerformancePeriod = {
  startDate: Date;
  endDate: Date;
};

export type SalesPeriod = "day" | "week" | "month" | "all";

/**
 * Membangun rentang periode penjualan berdasarkan filter singkat.
 * Note: 21 baris - sudah optimal dengan conditional logic untuk date range calculation.
 * Memecah lebih lanjut akan memisahkan business rule yang harus kohesif.
 */
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
