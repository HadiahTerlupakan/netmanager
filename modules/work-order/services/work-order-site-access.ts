import { resolveAllowedSiteIds } from "@/lib/authorization/allowed-site-ids";
import { lingkupSiteUntuk, type LingkupSite } from "@/modules/roles/client";

/** Resource RBAC yang toggle `site_only`-nya membatasi data work order. */
export const WORK_ORDER_RESOURCE = "workorders";

/** Site milik pengguna: site utama legacy dan/atau seluruh `userSites`. */
export interface WorkOrderSiteOwner {
  siteId?: string | null;
  siteIds?: readonly string[];
}

/**
 * Lingkup `workorders:site_only` seorang pengguna atas SELURUH site-nya
 * (`resolveAllowedSiteIds`), sama seperti jalur mobile dan inventory. Super
 * admin tidak pernah dibatasi; role tanpa toggle melihat semua site tenant.
 */
export function resolveWorkOrderSiteScope(input: {
  permissions?: readonly string[];
  owner: WorkOrderSiteOwner;
  isSuperAdmin: boolean;
}): LingkupSite {
  return lingkupSiteUntuk({
    permissions: input.permissions ?? [],
    resource: WORK_ORDER_RESOURCE,
    siteIds: resolveOwnerSiteIds(input.owner),
    isSuperAdmin: input.isSuperAdmin,
  });
}

/** Daftar site pengguna yang dipakai untuk lingkup work order. */
export function resolveOwnerSiteIds(owner: WorkOrderSiteOwner): string[] {
  return resolveAllowedSiteIds({
    siteId: owner.siteId,
    siteIds: owner.siteIds ? [...owner.siteIds] : undefined,
  });
}

/** Lingkup → parameter `siteIds` repository (`undefined` = tidak dibatasi). */
export function toSiteScopeIds(lingkup: LingkupSite): string[] | undefined {
  return lingkup.dibatasi ? [...lingkup.siteIds] : undefined;
}
