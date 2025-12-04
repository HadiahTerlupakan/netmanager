import type { WorkOrder, WorkOrderTask, WorkOrderAssignment, WorkOrderUpdate, WorkOrderAttachment, WorkOrderStatus, WorkOrderPriority, WorkOrderType, TaskStatus } from '@prisma/client';

export interface WorkOrderWithRelations extends WorkOrder {
    ticket?: {
        id: string;
        ticketNumber: string;
        subject: string;
    } | null;
    pelanggan: {
        id: string;
        idPelanggan: string;
        nama: string;
        email: string | null;
        noTelp: string | null;
    };
    department?: {
        id: string;
        name: string;
    } | null;
    assignedTo?: {
        id: string;
        fullName: string;
        email: string | null;
    } | null;
    tasks?: WorkOrderTask[];
    assignments?: (WorkOrderAssignment & {
        employee: {
            id: string;
            fullName: string;
        };
    })[];
    updates?: (WorkOrderUpdate & {
        createdBy?: {
            fullName: string;
        } | null;
    })[];
    attachments?: WorkOrderAttachment[];
}

export interface CreateWorkOrderData {
    pelangganId: string;
    ticketId?: string;
    type: WorkOrderType;
    title: string;
    description: string;
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
    internalNotes?: string;
}

export interface UpdateWorkOrderData {
    type?: WorkOrderType;
    title?: string;
    description?: string;
    status?: WorkOrderStatus;
    priority?: WorkOrderPriority;
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
    departmentId?: string;
    assignedToId?: string | null;
    pelangganId?: string;
    ticketId?: string;
    search?: string;
    dateFrom?: Date;
    dateTo?: Date;
    scheduledDateFrom?: Date;
    scheduledDateTo?: Date;
    unassignedOnly?: boolean;
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
    avgCompletionTimeHours: number;
    totalCost: number;
    avgRating: number | null;
    totalWithRating: number;
}

export interface IWorkOrderRepository {
    // CRUD Operations
    create(data: CreateWorkOrderData): Promise<WorkOrder>;
    createFromTicket(ticketId: string, additionalData?: Partial<CreateWorkOrderData>): Promise<WorkOrder>;
    findById(id: string): Promise<WorkOrderWithRelations | null>;
    findByWorkOrderNumber(workOrderNumber: string): Promise<WorkOrderWithRelations | null>;
    findAll(filters?: WorkOrderFilters, page?: number, limit?: number): Promise<{
        workOrders: WorkOrderWithRelations[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    update(id: string, data: UpdateWorkOrderData): Promise<WorkOrder>;
    delete(id: string): Promise<void>;

    // Status Management
    updateStatus(id: string, status: WorkOrderStatus, userId?: string): Promise<WorkOrder>;
    start(id: string, userId?: string): Promise<WorkOrder>;
    complete(id: string, resolutionNotes?: string, userId?: string): Promise<WorkOrder>;
    verify(id: string, userId?: string): Promise<WorkOrder>;
    close(id: string, userId?: string): Promise<WorkOrder>;
    cancel(id: string, reason: string, userId?: string): Promise<WorkOrder>;

    // Assignment
    assign(id: string, employeeId: string, role?: string): Promise<WorkOrder>;
    unassign(id: string): Promise<WorkOrder>;
    addAssignment(workOrderId: string, employeeId: string, role?: string): Promise<WorkOrderAssignment>;
    removeAssignment(assignmentId: string): Promise<void>;

    // Tasks
    addTask(data: CreateTaskData): Promise<WorkOrderTask>;
    updateTask(taskId: string, data: UpdateTaskData): Promise<WorkOrderTask>;
    deleteTask(taskId: string): Promise<void>;
    completeTask(taskId: string, userId: string): Promise<WorkOrderTask>;

    // Updates/Timeline
    addUpdate(data: AddUpdateData): Promise<WorkOrderUpdate>;
    getUpdates(workOrderId: string): Promise<WorkOrderUpdate[]>;

    // Attachments
    addAttachment(workOrderId: string, fileName: string, filePath: string, fileSize: number, fileType: string, caption?: string, uploadedById?: string): Promise<WorkOrderAttachment>;
    deleteAttachment(attachmentId: string): Promise<void>;

    // Statistics
    getStatistics(filters?: Omit<WorkOrderFilters, 'search'>): Promise<WorkOrderStatistics>;

    // Utilities
    generateWorkOrderNumber(): Promise<string>;
}
