import { LeaveRepository } from '../repositories/LeaveRepository'

export class EmployeeLeaveQueryService {
  private leaveRepository = new LeaveRepository()

  async getRecentRequests(userId: string) {
    return this.leaveRepository.findAll({ userId, take: 20 })
  }
}
