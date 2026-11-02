export interface UserContext {
  id: string;
  name?: string;
  role?: string;
  permissions?: string[];
  /** Site utama (legacy `User.siteId`). */
  siteId?: string;
  /** Seluruh site dari `userSites`; lingkup `site_only` memakai keduanya. */
  siteIds?: string[];
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
