import type {
  CreateRoleRepositoryInput,
  UpdateRoleRepositoryInput,
} from "../domain/ports/IRoleRepository";
import type { RoleMutationInput } from "./role-service.types";

/** Build normalized mutation payload used inside role service. */
export function buildRolePayload(
  input: RoleMutationInput,
  permissions: string[],
): RoleMutationInput {
  return {
    name: input.name,
    permissions,
    description: input.description,
    accessAdminPanel: input.accessAdminPanel,
    accessEmployeePanel: input.accessEmployeePanel,
    isRestricted: input.isRestricted,
    isTechnical: input.isTechnical,
    isSuperAdmin: input.isSuperAdmin,
    canApproveRab: input.canApproveRab,
    canReceiveWhatsappApproval: input.canReceiveWhatsappApproval,
  };
}

/** Build repository create payload for role persistence. */
export function toCreateRoleRepositoryInput(
  data: RoleMutationInput,
  permissionIds: string[],
): CreateRoleRepositoryInput {
  return {
    name: data.name,
    description: data.description,
    accessAdminPanel: data.accessAdminPanel,
    accessEmployeePanel: data.accessEmployeePanel,
    isRestricted: data.isRestricted,
    isTechnical: data.isTechnical,
    isSuperAdmin: data.isSuperAdmin,
    canApproveRab: data.canApproveRab,
    canReceiveWhatsappApproval: data.canReceiveWhatsappApproval,
    permissionIds,
  };
}

/** Build repository update payload for role persistence. */
export function toUpdateRoleRepositoryInput(
  data: RoleMutationInput,
  permissionIds: string[],
): UpdateRoleRepositoryInput {
  return {
    name: data.name,
    description: data.description,
    accessAdminPanel: data.accessAdminPanel,
    accessEmployeePanel: data.accessEmployeePanel,
    isRestricted: data.isRestricted,
    isTechnical: data.isTechnical,
    isSuperAdmin: data.isSuperAdmin,
    canApproveRab: data.canApproveRab,
    canReceiveWhatsappApproval: data.canReceiveWhatsappApproval,
    permissionIds,
  };
}
