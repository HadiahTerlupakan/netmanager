import { WorkOrderRepository } from "@/modules/work-order";

export class EmployeeWorkOrderQueryService {
  async getAssignedWorkOrders(userId: string) {
    const repo = new WorkOrderRepository();
    return repo.findAllForList({ assignedToId: userId });
  }
}
