export type PayrollErrorCode =
  | "PAYROLL_NOT_FOUND"
  | "ENTRY_NOT_FOUND"
  | "COMPONENT_NOT_FOUND"
  | "PROFILE_NOT_FOUND"
  | "SCHEDULE_NOT_FOUND"
  | "PERIOD_NOT_FOUND"
  | "INVALID_STATUS_TRANSITION"
  | "PERIOD_LOCKED"
  | "PERIOD_OVERLAP"
  | "CALCULATION_ERROR"
  | "COMPLIANCE_ERROR"
  | "NEGATIVE_NET_SALARY"
  | "BELOW_MINIMUM_WAGE"
  | "OVERTIME_CAP_EXCEEDED"
  | "ADVANCE_LIMIT_EXCEEDED"
  | "ADVANCE_NOT_ELIGIBLE"
  | "INVALID_FORMULA"
  | "APPROVAL_REQUIRED"
  | "ALREADY_PAID"
  | "DUPLICATE_ENTRY";

export class PayrollError extends Error {
  constructor(
    public readonly code: PayrollErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "PayrollError";
  }

  static notFound(entity: string, id: string): PayrollError {
    const codeMap: Record<string, PayrollErrorCode> = {
      payrollRun: "PAYROLL_NOT_FOUND",
      entry: "ENTRY_NOT_FOUND",
      component: "COMPONENT_NOT_FOUND",
      profile: "PROFILE_NOT_FOUND",
      schedule: "SCHEDULE_NOT_FOUND",
      period: "PERIOD_NOT_FOUND",
    };
    return new PayrollError(
      codeMap[entity] || "PAYROLL_NOT_FOUND",
      `${entity} with id ${id} not found`,
    );
  }

  static invalidTransition(from: string, to: string): PayrollError {
    return new PayrollError(
      "INVALID_STATUS_TRANSITION",
      `Cannot transition from ${from} to ${to}`,
    );
  }

  static periodLocked(periodId: string): PayrollError {
    return new PayrollError(
      "PERIOD_LOCKED",
      `Period ${periodId} is locked and cannot be modified`,
      { periodId },
    );
  }

  static calculationError(userId: string, reason: string): PayrollError {
    return new PayrollError(
      "CALCULATION_ERROR",
      `Calculation failed for user ${userId}: ${reason}`,
      { userId, reason },
    );
  }

  static belowMinimumWage(
    userId: string,
    salary: number,
    umr: number,
    region: string,
  ): PayrollError {
    return new PayrollError(
      "BELOW_MINIMUM_WAGE",
      `Salary ${salary} for user ${userId} is below UMR ${umr} (${region})`,
      { userId, salary, umr, region },
    );
  }
}
