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
    startDate: buildPayrollStartDate(previousPeriod, input.payPeriodDay),
    endDate: buildPayrollEndDate(input),
  };
}

function buildPayrollStartDate(
  previousPeriod: { monthIndex: number; year: number },
  payPeriodDay: number,
) {
  return new Date(
    previousPeriod.year,
    previousPeriod.monthIndex,
    payPeriodDay + 1,
  );
}

function buildPayrollEndDate(input: {
  month: number;
  year: number;
  payPeriodDay: number;
}) {
  return new Date(
    input.year,
    input.month - 1,
    input.payPeriodDay,
    PAYROLL_END_HOUR,
    PAYROLL_END_MINUTE,
    PAYROLL_END_SECOND,
  );
}

function resolvePreviousPayrollPeriod(month: number, year: number) {
  if (month === 1) {
    return { monthIndex: 11, year: year - 1 };
  }

  return { monthIndex: month - 2, year };
}
