export interface User {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  departmentId: string | null;
  siteId: string | null;
  isActive: boolean;
  isAttendanceRequired: boolean;
  createdAt: string;
  departments: { id: string; name: string } | null;
  sites?: {
    id: string;
    code: string;
    name: string;
  };
  userSites?: Array<{
    id: string;
    siteId: string;
    isPrimary: boolean;
    site: { id: string; code: string; name: string };
  }>;
  role?: {
    id: string;
    name: string;
  };
  lastVersionCode?: number;
  lastVersionName?: string;
  lastVersionUpdate?: string;
  lastLoginAt?: string;
}

export interface UserListResponse {
  users: User[];
  meta: {
    total: number;
    active: number;
    inactive: number;
  };
}

export interface UserListFilters {
  search?: string;
  status?: "all" | "active" | "inactive";
  tenantId?: string;
  page: number;
  limit: number;
}
