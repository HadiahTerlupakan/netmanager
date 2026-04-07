import { OvertimeRepository } from '../repositories/OvertimeRepository'

export class EmployeeOvertimeQueryService {
  private overtimeRepository = new OvertimeRepository()

  async getRecentRequests(userId: string) {
    return this.overtimeRepository.findAll({ userId, take: 20 })
  }
}
