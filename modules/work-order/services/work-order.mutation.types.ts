import type {
  WorkOrderPriority,
  WorkOrderStatus,
  WorkOrderType,
} from "../types/work-order.enums";

/**
 * Input untuk create work order dari API route.
 * PENTING: Field di sini HARUS sinkron dengan workOrderCreateSchema
 * di lib/validations/workorder.ts — Zod membuang field yang tidak ada di schema.
 */
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
  // Denormalized contact — diisi saat WO dibuat dari MixRadius/guest (tanpa pelangganId lokal)
  contactName?: string;
  contactPhone?: string;
  locationAddress?: string;
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
