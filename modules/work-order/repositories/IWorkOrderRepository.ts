import type {
  WorkOrderAssignments,
  WorkOrderAttachments,
  WorkOrders,
  WorkOrderStatus,
  WorkOrderTasks,
  WorkOrderType,
  WorkOrderUpdates,
} from "@prisma/client";
import type {
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
  WorkOrderWithRelations,
  AddUpdateData,
} from "./work-order.repository.types";

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
  WorkOrderWithRelations,
} from "./work-order.repository.types";

export interface IWorkOrderRepository {
  // CRUD Operations
  create(data: CreateWorkOrderData): Promise<WorkOrders>;
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
  /**
   * Optimized query for list views - fetches only essential fields
   * ~90% smaller response compared to findAll()
   */
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
  update(id: string, data: UpdateWorkOrderData): Promise<WorkOrders>;
  delete(id: string): Promise<void>;

  // Status Management
  updateStatus(
    id: string,
    status: WorkOrderStatus,
    userId?: string,
  ): Promise<WorkOrders>;
  start(id: string, userId?: string): Promise<WorkOrders>;
  complete(
    id: string,
    resolutionNotes?: string,
    userId?: string,
  ): Promise<WorkOrders>;
  verify(id: string, userId?: string): Promise<WorkOrders>;
  close(id: string, userId?: string): Promise<WorkOrders>;
  cancel(id: string, reason: string, userId?: string): Promise<WorkOrders>;

  // Assignment
  assign(id: string, userId: string, role?: string): Promise<WorkOrders>;
  unassign(id: string): Promise<WorkOrders>;
  addAssignment(
    workOrderId: string,
    userId: string,
    role?: string,
  ): Promise<WorkOrderAssignments>;
  removeAssignment(assignmentId: string): Promise<void>;

  // Tasks
  addTask(data: CreateTaskData): Promise<WorkOrderTasks>;
  updateTask(taskId: string, data: UpdateTaskData): Promise<WorkOrderTasks>;
  deleteTask(taskId: string): Promise<void>;
  completeTask(taskId: string, userId: string): Promise<WorkOrderTasks>;

  // Updates/Timeline
  addUpdate(data: AddUpdateData): Promise<WorkOrderUpdates>;
  getUpdates(workOrderId: string): Promise<WorkOrderUpdates[]>;

  // Attachments
  addAttachment(
    workOrderId: string,
    fileName: string,
    filePath: string,
    fileSize: number,
    fileType: string,
    caption?: string,
    uploadedById?: string,
  ): Promise<WorkOrderAttachments>;
  deleteAttachment(attachmentId: string, deletedById?: string): Promise<void>;

  // Statistics
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

  // Comments
  addComment(
    workOrderId: string,
    message: string,
    userId: string,
  ): Promise<unknown>;

  // Utilities
  generateWorkOrderNumber(): Promise<string>;
}
