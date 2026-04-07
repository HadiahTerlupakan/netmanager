import { getWorkOrderRepository } from '@/lib/repositories'

export class EmployeeWorkOrderQueryService {
  async getAssignedWorkOrders(userId: string) {
    const repo = getWorkOrderRepository()
    return repo.findAllForList({ assignedToId: userId })
  }
}
