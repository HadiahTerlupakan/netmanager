import type { CreateWorkOrderInput, UserContext } from "./WorkOrderService";

export function enforceSiteRestriction(input: {
  normalizedInput: CreateWorkOrderInput;
  userContext: UserContext;
  isSuperAdmin: boolean;
}): void {
  if (!shouldRestrictSite(input)) {
    return;
  }

  validateSiteAccess(input.normalizedInput, input.userContext.siteId);
  input.normalizedInput.siteId = input.userContext.siteId;
}

export function enforceDepartmentRestriction(input: {
  normalizedInput: CreateWorkOrderInput;
  userContext: UserContext;
  isSuperAdmin: boolean;
}): void {
  if (!shouldRestrictDepartment(input)) {
    return;
  }

  validateDepartmentAccess(
    input.normalizedInput,
    input.userContext.departmentId,
  );
  input.normalizedInput.departmentId = input.userContext.departmentId;
}

function shouldRestrictSite(input: {
  userContext: UserContext;
  isSuperAdmin: boolean;
}) {
  return (
    input.userContext.permissions?.includes("workorders:site_only") &&
    !input.isSuperAdmin
  );
}

function validateSiteAccess(
  input: CreateWorkOrderInput,
  userSiteId: string | undefined,
) {
  if (!input.siteId || input.siteId === userSiteId) {
    return;
  }

  throw new Error(
    "Akses ditolak: Anda hanya dapat membuat work order untuk site Anda",
  );
}

function shouldRestrictDepartment(input: {
  userContext: UserContext;
  isSuperAdmin: boolean;
}) {
  return (
    input.userContext.permissions?.includes("workorders:department_only") &&
    !input.isSuperAdmin
  );
}

function validateDepartmentAccess(
  input: CreateWorkOrderInput,
  userDepartmentId: string | undefined,
) {
  if (!input.departmentId || input.departmentId === userDepartmentId) {
    return;
  }

  throw new Error(
    "Akses ditolak: Anda hanya dapat membuat work order untuk departemen Anda",
  );
}
