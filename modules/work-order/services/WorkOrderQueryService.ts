import { WorkOrderRepository } from "../repositories/WorkOrderRepository";

function createWorkOrderRepository() {
  return new WorkOrderRepository();
}

export class WorkOrderQueryService {
  constructor(private readonly repository = createWorkOrderRepository()) {}

  /** Get aggregate work-order statistics for dashboards. */
  getStatistics(
    filters?: Parameters<WorkOrderRepository["getStatistics"]>[0],
    tenantId?: Parameters<WorkOrderRepository["getStatistics"]>[1],
  ) {
    return this.repository.getStatistics(filters, tenantId);
  }

  /** Get per-user work-order counts in a date range. */
  getUserWorkOrderStats(startDate: Date, endDate: Date, tenantId?: string) {
    return this.repository.getUserWorkOrderStats(startDate, endDate, tenantId);
  }

  /** Get site statistics filtered by work-order types. */
  getSiteStatsByType(
    types: Parameters<WorkOrderRepository["getSiteStatsByType"]>[0],
    limit: number,
    startDate: Date,
    endDate: Date,
    tenantId?: string,
  ) {
    return this.repository.getSiteStatsByType(
      types,
      limit,
      startDate,
      endDate,
      tenantId,
    );
  }

  /** Create a work order directly for internal orchestrations. */
  create(data: Parameters<WorkOrderRepository["create"]>[0]) {
    return this.repository.create(data);
  }

  /** Generate the next work-order number. */
  generateWorkOrderNumber() {
    return this.repository.generateWorkOrderNumber();
  }

  /** Add a task to a work order. */
  addTask(data: Parameters<WorkOrderRepository["addTask"]>[0]) {
    return this.repository.addTask(data);
  }
}
