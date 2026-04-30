import type {
  WorkOrderPriority,
  WorkOrderStatus,
  WorkOrderType,
} from "@prisma/client";

export interface CreateWorkOrderInput {
  type: WorkOrderType;
  title: string;
  description: string;
  priority?: WorkOrderPriority;
  pelangganId?: string;
  departmentId?: string;
  siteId?: string;
  scheduledDate?: Date | string;
  ticketId?: string;
  isInternal?: boolean;
}

export interface UpdateWorkOrderInput {
  title?: string;
  description?: string;
  priority?: WorkOrderPriority;
  status?: WorkOrderStatus;
  scheduledDate?: Date | string;
  departmentId?: string;
  siteId?: string;
  assignedToId?: string;
  resolutionNotes?: string;
}
