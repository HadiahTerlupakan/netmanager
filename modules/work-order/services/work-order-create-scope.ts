import {
  siteBolehDiakses,
  tanpaDataSamaSekali,
  type LingkupSite,
} from "@/modules/roles/client";
import type { CreateWorkOrderInput, UserContext } from "./WorkOrderService";
import { resolveWorkOrderSiteScope } from "./work-order-site-access";

/**
 * Kunci site work order baru ke salah satu site pembuatnya bila role memegang
 * `workorders:site_only`. Karyawan multi-site boleh memilih site mana pun
 * miliknya; tanpa pilihan, site utama dipakai. Pembuat terbatas tanpa site
 * ditolak (fail closed) — work order tanpa site tidak akan pernah bisa dibuka
 * lagi oleh role terbatas.
 */
export function enforceSiteRestriction(input: {
  normalizedInput: CreateWorkOrderInput;
  userContext: UserContext;
  isSuperAdmin: boolean;
}): void {
  const lingkup = resolveWorkOrderSiteScope({
    permissions: input.userContext.permissions,
    owner: input.userContext,
    isSuperAdmin: input.isSuperAdmin,
  });
  if (!lingkup.dibatasi) {
    return;
  }

  validateSiteAccess(input.normalizedInput, lingkup);
  if (input.normalizedInput.siteId) return;
  input.normalizedInput.siteId = resolveDefaultSiteId(
    lingkup.siteIds,
    input.userContext.siteId,
  );
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

function validateSiteAccess(input: CreateWorkOrderInput, lingkup: LingkupSite) {
  if (tanpaDataSamaSekali(lingkup)) {
    throw new Error(
      "Akses ditolak: Akun Anda belum diberi site, jadi belum bisa membuat work order. Minta admin mengatur site akun Anda.",
    );
  }

  if (!input.siteId || siteBolehDiakses(lingkup, input.siteId)) {
    return;
  }

  throw new Error(
    "Akses ditolak: Anda hanya dapat membuat work order untuk site Anda",
  );
}

/** Site utama bila termasuk lingkup, selain itu site pertama milik pengguna. */
function resolveDefaultSiteId(
  allowedSiteIds: readonly string[],
  primarySiteId: string | undefined,
): string | undefined {
  if (primarySiteId && allowedSiteIds.includes(primarySiteId)) {
    return primarySiteId;
  }
  return allowedSiteIds[0];
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
