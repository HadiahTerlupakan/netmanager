import type { WorkOrderFilters } from "../domain/entities/WorkOrderRepositoryTypes";

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
