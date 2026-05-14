import { AttendanceRepository } from "../repositories/AttendanceRepository";

export class AttendancePayrollQueryService {
  constructor(private readonly repository = new AttendanceRepository()) {}

  /** Find payroll evaluations for one user in a date range. */
  findManyPayrollEvaluationsByUserAndDateRange(
    input: Parameters<
      AttendanceRepository["findManyPayrollEvaluationsByUserAndDateRange"]
    >[0],
  ) {
    return this.repository.findManyPayrollEvaluationsByUserAndDateRange(input);
  }
}
