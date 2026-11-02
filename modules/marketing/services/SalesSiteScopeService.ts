import { isSuperAdmin } from "@/lib/auth/super-admin";
import { resolveAllowedSiteIds } from "@/lib/authorization/allowed-site-ids";
import { lingkupSiteUntuk } from "@/modules/roles";

/** Resource izin layar sales; `<resource>:site_only` mengunci ke site sendiri. */
export const SALES_SITE_SCOPE_RESOURCE = {
  overview: "sales",
  dashboard: "sales_dashboard",
} as const;

export type SalesSiteScopeResource =
  (typeof SALES_SITE_SCOPE_RESOURCE)[keyof typeof SALES_SITE_SCOPE_RESOURCE];

interface SalesScopeUser {
  role?: string | null;
  isSuperAdmin?: boolean;
  siteId?: string | null;
  siteIds?: string[];
}

/**
 * Daftar site yang boleh dibaca layar sales, dalam bentuk yang dipahami
 * `SalesAnalyticsRepository`: `undefined` = tanpa batas, `[]` = dibatasi tanpa
 * site (tidak ada data). Izin dicocokkan persis pada daftar izin role — bukan
 * lewat `hasPermission`, yang mengembangkan `*` sehingga role wildcard
 * non-super keliru dianggap dibatasi.
 */
export function resolveSalesAllowedSiteIds(input: {
  user: SalesScopeUser;
  permissions: readonly string[];
  resource: SalesSiteScopeResource;
}): string[] | undefined {
  const scope = lingkupSiteUntuk({
    permissions: input.permissions,
    resource: input.resource,
    siteIds: resolveAllowedSiteIds(input.user),
    isSuperAdmin: isSuperAdmin(input.user),
  });
  return scope.dibatasi ? [...scope.siteIds] : undefined;
}
