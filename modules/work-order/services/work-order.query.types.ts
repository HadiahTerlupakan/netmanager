import type { WorkOrderFilters } from "../domain/entities/WorkOrderRepositoryTypes";

export interface WorkOrderListOptions {
  page?: number;
  limit?: number;
  filters?: WorkOrderFilters;
  userId?: string;
  userPermissions?: string[];
  userDepartmentId?: string;
  userSiteId?: string;
  /** Seluruh site pengguna (`userSites`); dipakai lingkup `site_only`. */
  userSiteIds?: string[];
  userRole?: string;
}
