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

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}
