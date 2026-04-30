import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";

export type DashboardPeriod = "day" | "week" | "month" | "custom" | "all";

export type DashboardRangeInput = {
  period: DashboardPeriod;
  customStart?: string | null;
  customEnd?: string | null;
};

/** Build date range used by admin sales dashboard filters. */
export function buildDashboardRange(input: DashboardRangeInput) {
  const now = new Date();
  if (input.period === "day") return buildDayRange(now);
  if (input.period === "week") return buildWeekRange(now);
  if (input.period === "month") return buildMonthRange(now);
  if (hasCustomRange(input)) return buildCustomRange(input);
  return buildFallbackRange(input.period, now);
}

function buildDayRange(now: Date) {
  return {
    startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    endDate: buildTodayEnd(now),
  };
}

function buildWeekRange(now: Date) {
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - startDate.getDay() + 1);
  startDate.setTime(toStartOfDay(startDate).getTime());
  return { startDate, endDate: buildTodayEnd(now) };
}

function buildMonthRange(now: Date) {
  return {
    startDate: new Date(now.getFullYear(), now.getMonth(), 1),
    endDate: buildTodayEnd(now),
  };
}

function buildCustomRange(input: Required<DashboardRangeInput>) {
  const startDate = new Date(input.customStart);
  const endDate = new Date(input.customEnd);
  startDate.setTime(toStartOfDay(startDate).getTime());
  endDate.setTime(toEndOfDay(endDate).getTime());
  return { startDate, endDate };
}

function buildFallbackRange(period: DashboardPeriod, now: Date) {
  return {
    startDate: period === "all" ? new Date(0) : buildMonthRange(now).startDate,
    endDate: buildTodayEnd(now),
  };
}

function buildTodayEnd(now: Date) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
}

function hasCustomRange(
  input: DashboardRangeInput,
): input is Required<DashboardRangeInput> {
  return (
    input.period === "custom" && Boolean(input.customStart && input.customEnd)
  );
}
