import { LeaveRepository } from "../repositories/LeaveRepository";

const DEFAULT_RECENT_REQUEST_LIMIT = 20;

export class EmployeeLeaveQueryService {
  private readonly leaveRepository: LeaveRepository;

  constructor(leaveRepository = new LeaveRepository()) {
    this.leaveRepository = leaveRepository;
  }

  /** Get paginated employee leave requests for mobile and self-service views. */
  async getRequests(input: { userId: string; tenantId: string }) {
    return this.leaveRepository.findAll({
      userId: input.userId,
      tenantId: input.tenantId,
      take: DEFAULT_RECENT_REQUEST_LIMIT,
    });
  }

  /** Get recent employee leave requests for lightweight history widgets. */
  async getRecentRequests(userId: string) {
    return this.leaveRepository.findAll({
      userId,
      take: DEFAULT_RECENT_REQUEST_LIMIT,
    });
  }
}
