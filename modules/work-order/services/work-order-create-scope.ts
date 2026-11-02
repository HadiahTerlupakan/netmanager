import type { CreateWorkOrderInput, UserContext } from "./WorkOrderService";

/**
 * Kunci site work order baru ke site pembuatnya bila role memegang
 * `workorders:site_only`. Pembuat terbatas tanpa site ditolak (fail closed) —
 * work order tanpa site tidak akan pernah bisa dibuka lagi oleh role terbatas.
 */
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

/** Kunci departemen work order baru; simetris dengan `enforceSiteRestriction`. */
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
  if (!userSiteId) {
    throw new Error(
      "Akses ditolak: Akun Anda belum diberi site, jadi belum bisa membuat work order. Minta admin mengatur site akun Anda.",
    );
  }

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
  if (!userDepartmentId) {
    throw new Error(
      "Akses ditolak: Akun Anda belum diberi departemen, jadi belum bisa membuat work order. Minta admin mengatur departemen akun Anda.",
    );
  }

  if (!input.departmentId || input.departmentId === userDepartmentId) {
    return;
  }

  throw new Error(
    "Akses ditolak: Anda hanya dapat membuat work order untuk departemen Anda",
  );
}
