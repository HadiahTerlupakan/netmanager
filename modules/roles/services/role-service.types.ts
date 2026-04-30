export type RoleMutationInput = {
  name: string;
  description?: string;
  permissions: string[];
  accessAdminPanel?: boolean;
  accessEmployeePanel?: boolean;
  isRestricted?: boolean;
  isTechnical?: boolean;
  isSuperAdmin?: boolean;
  canApproveRab?: boolean;
  canReceiveWhatsappApproval?: boolean;
};

export type RoleMutationContext = {
  tenantId?: string | null;
};
