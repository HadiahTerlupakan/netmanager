const PAYROLL_END_HOUR = 23;
const PAYROLL_END_MINUTE = 59;
const PAYROLL_END_SECOND = 59;

/** Hitung rentang periode payroll berdasarkan pay period day. */
export function getPeriodDateRange(input: {
  month: number;
  year: number;
  payPeriodDay: number;
}): { startDate: Date; endDate: Date } {
  const previousPeriod = resolvePreviousPayrollPeriod(input.month, input.year);

  return {
    startDate: new Date(
      previousPeriod.year,
      previousPeriod.monthIndex,
      input.payPeriodDay + 1,
    ),
    endDate: new Date(
      input.year,
      input.month - 1,
      input.payPeriodDay,
      PAYROLL_END_HOUR,
      PAYROLL_END_MINUTE,
      PAYROLL_END_SECOND,
    ),
  };
}

function resolvePreviousPayrollPeriod(month: number, year: number) {
  if (month === 1) {
    return { monthIndex: 11, year: year - 1 };
  }

  return { monthIndex: month - 2, year };
}
