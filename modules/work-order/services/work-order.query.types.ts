import type { WorkOrderFilters } from "../repositories/work-order.repository.types";

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
