import { isSuperAdmin } from "@/lib/auth/super-admin";
import { resolveAllowedSiteIds } from "@/lib/authorization/allowed-site-ids";

import { lingkupSiteUntuk, type LingkupSite } from "../domain/lingkup-site";

/** Resource izin manajemen site; `site:site_only` mengunci ke site sendiri. */
export const SITE_SCOPE_RESOURCE = "site";

interface PenggunaKelolaSite {
  role?: string | null;
  isSuperAdmin?: boolean;
  siteId?: string | null;
  siteIds?: string[];
}

/**
 * Lingkup site yang boleh dibaca dan dikelola pengguna di layar manajemen site
 * (daftar, detail, ubah, hapus, jadwal SO per site). Izin dicocokkan persis
 * pada daftar izin role — bukan lewat `hasPermission`, yang mengembangkan `*`
 * sehingga role wildcard non-super keliru dianggap dibatasi.
 */
export function lingkupKelolaSite(input: {
  user: PenggunaKelolaSite;
  permissions: readonly string[];
}): LingkupSite {
  return lingkupSiteUntuk({
    permissions: input.permissions,
    resource: SITE_SCOPE_RESOURCE,
    siteIds: resolveAllowedSiteIds(input.user),
    isSuperAdmin: isSuperAdmin(input.user),
  });
}
