import { OvertimeRepository } from "../repositories/OvertimeRepository";

export class OvertimeQueryService {
  constructor(private readonly repository = new OvertimeRepository()) {}

  /** Find one active overtime request in a date range. */
  findActiveRequestByDate(
    userId: string,
    tenantId: string | undefined,
    startDate: Date,
    endDate: Date,
  ) {
    return this.repository.findActiveRequestByDate(
      userId,
      tenantId,
      startDate,
      endDate,
    );
  }
}

export class OvertimePayrollQueryService {
  constructor(private readonly repository = new OvertimeRepository()) {}

  /** Get grouped overtime stats for report and payroll calculations. */
  getUserOvertimeStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.repository.getUserOvertimeStats(
      startDate,
      endDate,
      siteId,
      departmentId,
    );
  }
}
