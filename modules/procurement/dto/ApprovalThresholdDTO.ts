import type { ApprovalThreshold } from "../domain/entities/ApprovalThreshold";
import type { ApprovalThresholdWithRole } from "../domain/ports/IApprovalThresholdRepository";

export interface ApprovalThresholdDTO {
  id: string;
  scope: string;
  roleId: string;
  roleName: string | null;
  minAmount: number;
  maxAmount: number | null;
  description: string | null;
  isActive: boolean;
  tenantId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toApprovalThresholdDTO(
  entity: ApprovalThreshold | ApprovalThresholdWithRole,
): ApprovalThresholdDTO {
  const withRole = entity as Partial<ApprovalThresholdWithRole>;
  return {
    id: entity.id,
    scope: entity.scope,
    roleId: entity.roleId,
    roleName: withRole.role?.name ?? null,
    minAmount: entity.minAmount,
    maxAmount: entity.maxAmount,
    description: entity.description,
    isActive: entity.isActive,
    tenantId: entity.tenantId,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}
