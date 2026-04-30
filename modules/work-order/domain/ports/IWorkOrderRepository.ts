import type {
  WorkOrderAssignmentEntity,
  WorkOrderAttachmentEntity,
  WorkOrderEntity,
  WorkOrderStatus,
  WorkOrderTaskEntity,
  WorkOrderType,
  WorkOrderUpdateEntity,
  WorkOrderWithRelations,
} from "../entities/WorkOrderEntity";
import type {
  AddUpdateData,
  CreateTaskData,
  CreateWorkOrderData,
  IssueStatistic,
  SiteStatistic,
  StaleReminderWorkOrder,
  TopPerformer,
  UpdateTaskData,
  UpdateWorkOrderData,
  WorkOrderFilters,
  WorkOrderListItem,
  WorkOrderListSummary,
  WorkOrderStatistics,
} from "../entities/WorkOrderRepositoryTypes";

export type {
  AddUpdateData,
  CreateTaskData,
  CreateWorkOrderData,
  IssueStatistic,
  SiteStatistic,
  StaleReminderWorkOrder,
  TopPerformer,
  UpdateTaskData,
  UpdateWorkOrderData,
  WorkOrderFilters,
  WorkOrderListItem,
  WorkOrderListSummary,
  WorkOrderStatistics,
} from "../entities/WorkOrderRepositoryTypes";
export type { WorkOrderWithRelations } from "../entities/WorkOrderEntity";

export interface IWorkOrderRepository {
  create(data: CreateWorkOrderData): Promise<WorkOrderEntity>;
  findById(id: string): Promise<WorkOrderWithRelations | null>;
  findByWorkOrderNumber(
    workOrderNumber: string,
  ): Promise<WorkOrderWithRelations | null>;
  findAll(
    filters?: WorkOrderFilters,
    page?: number,
    limit?: number,
  ): Promise<{
    workOrders: WorkOrderWithRelations[];
    total: number;
    page: number;
    totalPages: number;
  }>;
  findAllForList(
    filters?: WorkOrderFilters,
    page?: number,
    limit?: number,
  ): Promise<{
    workOrders: WorkOrderListItem[];
    total: number;
    page: number;
    totalPages: number;
    summary: WorkOrderListSummary;
  }>;
  findStaleReminderWorkOrders(now: Date): Promise<StaleReminderWorkOrder[]>;
  update(id: string, data: UpdateWorkOrderData): Promise<WorkOrderEntity>;
  delete(id: string): Promise<void>;
  updateStatus(
    id: string,
    status: WorkOrderStatus,
    userId?: string,
  ): Promise<WorkOrderEntity>;
  start(id: string, userId?: string): Promise<WorkOrderEntity>;
  complete(
    id: string,
    resolutionNotes?: string,
    userId?: string,
  ): Promise<WorkOrderEntity>;
  verify(id: string, userId?: string): Promise<WorkOrderEntity>;
  close(id: string, userId?: string): Promise<WorkOrderEntity>;
  cancel(id: string, reason: string, userId?: string): Promise<WorkOrderEntity>;
  assign(id: string, userId: string, role?: string): Promise<WorkOrderEntity>;
  unassign(id: string): Promise<WorkOrderEntity>;
  addAssignment(
    workOrderId: string,
    userId: string,
    role?: string,
  ): Promise<WorkOrderAssignmentEntity>;
  removeAssignment(assignmentId: string): Promise<void>;
  addTask(data: CreateTaskData): Promise<WorkOrderTaskEntity>;
  updateTask(
    taskId: string,
    data: UpdateTaskData,
  ): Promise<WorkOrderTaskEntity>;
  deleteTask(taskId: string): Promise<void>;
  completeTask(taskId: string, userId: string): Promise<WorkOrderTaskEntity>;
  addUpdate(data: AddUpdateData): Promise<WorkOrderUpdateEntity>;
  getUpdates(workOrderId: string): Promise<WorkOrderUpdateEntity[]>;
  addAttachment(
    workOrderId: string,
    fileName: string,
    filePath: string,
    fileSize: number,
    fileType: string,
    caption?: string,
    uploadedById?: string,
  ): Promise<WorkOrderAttachmentEntity>;
  deleteAttachment(attachmentId: string, deletedById?: string): Promise<void>;
  getStatistics(
    filters?: Omit<WorkOrderFilters, "search">,
    tenantId?: string,
  ): Promise<WorkOrderStatistics>;
  getTopPerformers(
    limit?: number,
    dateFrom?: Date,
    dateTo?: Date,
    departmentId?: string,
    siteId?: string,
  ): Promise<TopPerformer[]>;
  getIssueStatistics(
    limit?: number,
    dateFrom?: Date,
    dateTo?: Date,
    departmentId?: string,
    siteId?: string,
  ): Promise<IssueStatistic[]>;
  getSiteStatistics(
    limit?: number,
    dateFrom?: Date,
    dateTo?: Date,
    departmentId?: string,
    siteId?: string,
  ): Promise<SiteStatistic[]>;
  getDisconnectionStatistics(
    dateFrom?: Date,
    dateTo?: Date,
    departmentId?: string,
    siteId?: string,
  ): Promise<Array<{ reason: string; count: number }>>;
  getUserWorkOrderStats(
    dateFrom: Date,
    dateTo: Date,
    tenantId?: string,
  ): Promise<Array<{ userId: string; count: number }>>;
  getSiteStatsByType(
    types: WorkOrderType[],
    limit: number,
    dateFrom: Date,
    dateTo: Date,
    tenantId?: string,
  ): Promise<Array<{ siteId: string; siteName: string; count: number }>>;
  getAdminResponseStats(
    dateFrom: Date,
    dateTo: Date,
    departmentId?: string,
  ): Promise<
    Array<{
      userName: string;
      totalResponses: number;
      avgResponseTimeMinutes: number;
    }>
  >;
  addComment(
    workOrderId: string,
    message: string,
    userId: string,
  ): Promise<unknown>;
  generateWorkOrderNumber(): Promise<string>;
}
