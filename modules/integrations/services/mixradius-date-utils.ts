const EMPTY_DATE_PLACEHOLDER = "0000-00-00 00:00:00";

/**
 * Parse MixRadius date string into Date.
 */
export function parseMixRadiusDate(
  dateValue: string | null | undefined,
): Date | null {
  if (!dateValue || dateValue === EMPTY_DATE_PLACEHOLDER) {
    return null;
  }

  const parsedDate = new Date(dateValue);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

/**
 * Get yesterday date in YYYY-MM-DD format.
 */
export function getYesterdayDateString(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split("T")[0] ?? "";
}

/**
 * Get current month date range in YYYY-MM-DD format.
 */
export function getCurrentMonthDateRange(): {
  startDate: string;
  endDate: string;
} {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  return {
    startDate: `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`,
    endDate: `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(lastDayOfMonth).padStart(2, "0")}`,
  };
}
