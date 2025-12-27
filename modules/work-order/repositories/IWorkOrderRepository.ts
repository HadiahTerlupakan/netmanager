import type { WorkOrders, WorkOrderTasks, WorkOrderAssignments, WorkOrderUpdates, WorkOrderAttachments, WorkOrderStatus, WorkOrderPriority, WorkOrderType, TaskStatus } from '@prisma/client';

export interface WorkOrderWithRelations extends WorkOrders {
    pelanggan?: {
        id: string;
        idPelanggan: string;
        nama: string;
        email: string | null;
        noTelp: string | null;
    } | null;
    site?: {
        id: string;
        code: string;
        name: string;
    } | null;
    department?: {
        id: string;
        name: string;
    } | null;
    assignedTo?: {
        id: string;
        name: string | null;
        email: string | null;
    } | null;
    tasks?: WorkOrderTasks[];
    assignments?: (WorkOrderAssignments & {
        user: {
            id: string;
            name: string | null;
        };
    })[];
    updates?: (WorkOrderUpdates & {
        createdBy?: {
            name: string | null;
        } | null;
    })[];
    attachments?: WorkOrderAttachments[];
}

export interface CreateWorkOrderData {
    workOrderNumber?: string;
    pelangganId?: string;
    siteId?: string;
    type: WorkOrderType;
    title: string;
    description: string;
    status?: WorkOrderStatus;
    priority?: WorkOrderPriority;
    departmentId?: string;
    assignedToId?: string;
    locationAddress?: string;
    locationLat?: number;
    locationLng?: number;
    contactName?: string;
    contactPhone?: string;
    scheduledDate?: Date;
    scheduledTimeStart?: string;
    scheduledTimeEnd?: string;
    estimatedHours?: number;
    estimatedCost?: number;
    requiredMaterials?: any;
    internalNotes?: string;
    disconnectionReason?: string;
    createdById?: string;
    ticketId?: string;
}

export interface UpdateWorkOrderData {
    type?: WorkOrderType;
    title?: string;
    description?: string;
    status?: WorkOrderStatus;
    priority?: WorkOrderPriority;
    siteId?: string | null;
    departmentId?: string | null;
    assignedToId?: string | null;
    locationAddress?: string;
    locationLat?: number;
    locationLng?: number;
    contactName?: string;
    contactPhone?: string;
    scheduledDate?: Date;
    scheduledTimeStart?: string;
    scheduledTimeEnd?: string;
    estimatedHours?: number;
    actualHours?: number;
    estimatedCost?: number;
    actualCost?: number;
    requiredMaterials?: any;
    usedMaterials?: any;
    internalNotes?: string;
    resolutionNotes?: string;
    customerFeedback?: string;
    rating?: number;
    disconnectionReason?: string;
}

export interface CreateTaskData {
    workOrderId: string;
    title: string;
    description?: string;
    order?: number;
}

export interface UpdateTaskData {
    title?: string;
    description?: string;
    status?: TaskStatus;
    order?: number;
    completedById?: string;
}

export interface AddUpdateData {
    workOrderId: string;
    updateType: 'STATUS_CHANGE' | 'PROGRESS_UPDATE' | 'NOTE' | 'PHOTO';
    message: string;
    oldStatus?: WorkOrderStatus;
    newStatus?: WorkOrderStatus;
    createdById?: string;
}

export interface WorkOrderFilters {
    status?: WorkOrderStatus | WorkOrderStatus[];
    priority?: WorkOrderPriority | WorkOrderPriority[];
    type?: WorkOrderType | WorkOrderType[];
    siteId?: string;
    departmentId?: string;
    assignedToId?: string | null;
    pelangganId?: string;
    search?: string;
    dateFrom?: Date;
    dateTo?: Date;
    scheduledDateFrom?: Date;
    scheduledDateTo?: Date;
    unassignedOnly?: boolean;
    involvedUserId?: string;
}

export interface WorkOrderStatistics {
    total: number;
    pending: number;
    assigned: number;
    inProgress: number;
    onHold: number;
    completed: number;
    verified: number;
    closed: number;
    cancelled: number;
    urgentOpen: number;
    avgCompletionTimeHours: number;
    totalCost: number;
    avgRating: number | null;
    totalWithRating: number;
}

export interface TopPerformer {
    userName: string;
    role?: string;
    site?: string;
    count: number;
    avgCompletionTime: number;
}

export interface IssueStatistic {
    issue: string;
    count: number;
}

export interface SiteStatistic {
    siteName: string;
    count: number;
    mostCommonIssue: string;
}

export interface IWorkOrderRepository {
    // CRUD Operations
    create(data: CreateWorkOrderData): Promise<WorkOrders>;
    findById(id: string): Promise<WorkOrderWithRelations | null>;
    findByWorkOrderNumber(workOrderNumber: string): Promise<WorkOrderWithRelations | null>;
    findAll(filters?: WorkOrderFilters, page?: number, limit?: number): Promise<{
        workOrders: WorkOrderWithRelations[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    update(id: string, data: UpdateWorkOrderData): Promise<WorkOrders>;
    delete(id: string): Promise<void>;

    // Status Management
    updateStatus(id: string, status: WorkOrderStatus, userId?: string): Promise<WorkOrders>;
    start(id: string, userId?: string): Promise<WorkOrders>;
    complete(id: string, resolutionNotes?: string, userId?: string): Promise<WorkOrders>;
    verify(id: string, userId?: string): Promise<WorkOrders>;
    close(id: string, userId?: string): Promise<WorkOrders>;
    cancel(id: string, reason: string, userId?: string): Promise<WorkOrders>;

    // Assignment
    assign(id: string, userId: string, role?: string): Promise<WorkOrders>;
    unassign(id: string): Promise<WorkOrders>;
    addAssignment(workOrderId: string, userId: string, role?: string): Promise<WorkOrderAssignments>;
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
    addAttachment(workOrderId: string, fileName: string, filePath: string, fileSize: number, fileType: string, caption?: string, uploadedById?: string): Promise<WorkOrderAttachments>;
    deleteAttachment(attachmentId: string): Promise<void>;

    // Statistics
    getStatistics(filters?: Omit<WorkOrderFilters, 'search'>): Promise<WorkOrderStatistics>;
    getTopPerformers(limit?: number, dateFrom?: Date, dateTo?: Date): Promise<TopPerformer[]>;
    getIssueStatistics(limit?: number, dateFrom?: Date, dateTo?: Date): Promise<IssueStatistic[]>;
    getSiteStatistics(limit?: number, dateFrom?: Date, dateTo?: Date): Promise<SiteStatistic[]>;
    getDisconnectionStatistics(dateFrom?: Date, dateTo?: Date): Promise<Array<{ reason: string; count: number }>>;
    getUserWorkOrderStats(dateFrom: Date, dateTo: Date): Promise<Array<{ userId: string; count: number }>>;
    getSiteStatsByType(types: WorkOrderType[], limit: number, dateFrom: Date, dateTo: Date): Promise<Array<{ siteId: string; siteName: string; count: number }>>;

    // Comments
    addComment(workOrderId: string, message: string, userId: string): Promise<any>;

    // Utilities
    generateWorkOrderNumber(): Promise<string>;
}
