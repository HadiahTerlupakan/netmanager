import type {
  WorkOrderPriority,
  WorkOrderStatus,
  WorkOrderType,
} from "@prisma/client";
import type { WorkOrderFilters } from "../repositories/IWorkOrderRepository";

export interface UserContext {
  id: string;
  name?: string;
  role?: string;
  permissions?: string[];
  siteId?: string;
  departmentId?: string;
  tenantId?: string;
  isSuperAdmin?: boolean;
}

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

export interface WorkOrderListOptions {
  page?: number;
  limit?: number;
  filters?: WorkOrderFilters;
  userId?: string;
  userPermissions?: string[];
  userDepartmentId?: string;
  userSiteId?: string;
  userRole?: string;
}

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface MobileWorkOrderMaterialReturnInput {
  barangId: string;
  gudangId: string;
  jumlah: number;
  kondisi?: "BARU" | "BEKAS" | "RUSAK";
}

export interface MobileWorkOrderMaterialReturnResult {
  id: string;
  nama: string;
  jumlah: number;
  satuan: string;
  kondisi: string;
  barangId: string;
  gudangId: string;
}
