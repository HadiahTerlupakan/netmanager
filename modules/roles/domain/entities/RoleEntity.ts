export interface PermissionEntity {
  id: string;
  name: string;
  resource: string;
  action: string;
  description: string | null;
}

export interface RoleUserCount {
  users: number;
}

export interface RoleEntity {
  id: string;
  name: string;
  description: string | null;
  accessAdminPanel: boolean;
  accessEmployeePanel: boolean;
  isRestricted: boolean;
  isTechnical: boolean;
  isSuperAdmin: boolean;
  canApproveRab: boolean;
  canReceiveWhatsappApproval: boolean;
  createdAt: Date;
  updatedAt: Date;
  permissions: PermissionEntity[];
  counts?: RoleUserCount;
}

export interface UserRoleContextEntity {
  roleId: string | null;
  roleName: string | null;
}
