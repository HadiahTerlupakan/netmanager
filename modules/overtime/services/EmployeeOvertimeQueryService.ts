import type { IOvertimeRepository } from "../domain/ports/IOvertimeRepository";
import { OvertimeRepository } from "../repositories/OvertimeRepository";

const RECENT_REQUESTS_LIMIT = 20;

export class EmployeeOvertimeQueryService {
  private overtimeRepository: IOvertimeRepository;

  constructor(
    overtimeRepository: IOvertimeRepository = new OvertimeRepository(),
  ) {
    this.overtimeRepository = overtimeRepository;
  }

  /** Get recent overtime requests for one employee. */
  async getRecentRequests(userId: string) {
    return this.overtimeRepository.findAll({
      userId,
      take: RECENT_REQUESTS_LIMIT,
    });
  }
}
