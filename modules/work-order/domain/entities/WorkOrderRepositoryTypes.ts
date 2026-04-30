import type {
  TaskStatus,
  WorkOrderPriority,
  WorkOrderStatus,
  WorkOrderType,
  WorkOrderWithRelations,
} from "./WorkOrderEntity";

export type { WorkOrderWithRelations };

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
  requiredMaterials?: unknown;
  internalNotes?: string;
  disconnectionReason?: string;
  createdById?: string;
  ticketId?: string;
  isInternal?: boolean;
  tenantId?: string;
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
  requiredMaterials?: unknown;
  returnedMaterials?: unknown;
  internalNotes?: string;
  resolutionNotes?: string;
  customerFeedback?: string;
  rating?: number;
  disconnectionReason?: string;
  tenantId?: string;
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
  updateType:
    | "STATUS_CHANGE"
    | "PROGRESS_UPDATE"
    | "NOTE"
    | "PHOTO"
    | "COMMENT";
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
  assignedMitraId?: string | null;
  pelangganId?: string;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  scheduledDateFrom?: Date;
  scheduledDateTo?: Date;
  unassignedOnly?: boolean;
  involvedUserId?: string;
  isInternal?: boolean;
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

export interface TopWorkOrderCustomer {
  name: string;
  phone: string | null;
  count: number;
  siteName?: string | null;
}

export interface WorkOrderListSummary {
  completed: number;
  unfinished: number;
  focut: number;
  dismantle: number;
  averageCompletionTimeHours: number;
  topCustomers: TopWorkOrderCustomer[];
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

export interface StaleReminderWorkOrder {
  id: string;
  workOrderNumber: string;
  title: string;
  type: WorkOrderType;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  departmentId: string | null;
  siteId: string | null;
  assignedToId: string | null;
  createdAt: Date;
}

export interface WorkOrderListItem {
  id: string;
  workOrderNumber: string;
  title: string;
  type: WorkOrderType;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  scheduledDate: Date | null;
  contactName: string | null;
  contactPhone: string | null;
  isInternal: boolean;
  requestedById: string | null;
  createdAt: Date;
  pelanggan: {
    id: string;
    idPelanggan: string;
    nama: string;
    noTelp?: string | null;
  } | null;
  site: {
    id: string;
    name: string;
    code: string;
  } | null;
  department: {
    id: string;
    name: string;
  } | null;
  assignedTo: {
    id: string;
    name: string | null;
  } | null;
  createdBy: {
    id: string;
    name: string | null;
  } | null;
}
