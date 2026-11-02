import { resolveAllowedSiteIds } from "@/lib/authorization/allowed-site-ids";

interface SiteScopedSession {
  siteId?: string | null;
  siteIds?: string[];
}

interface SiteScopedCanvasing {
  user?: { siteId: string | null } | null;
  mitra?: { siteId: string | null } | null;
}

interface CanvasingSiteAccessInput {
  isSuperAdmin: boolean;
  permissions: string[];
  session: SiteScopedSession;
  canvasing: SiteScopedCanvasing;
}

/**
 * Site yang boleh dilihat pengguna `canvasing:site_only` — satu himpunan yang
 * dipakai daftar maupun detail/approve/reject. Dulu daftar memakai `siteIds`
 * sementara detail hanya `siteId` utama, sehingga canvasing di site tambahan
 * tampil di daftar tetapi ditolak saat dibuka (dan sebaliknya).
 */
export function resolveCanvasingAllowedSiteIds(
  session: SiteScopedSession,
): string[] {
  return resolveAllowedSiteIds(session);
}

/** Cek akses site-scoped untuk data canvasing. */
export function canAccessCanvasingSite(
  input: CanvasingSiteAccessInput,
): boolean {
  if (
    input.isSuperAdmin ||
    !input.permissions.includes("canvasing:site_only")
  ) {
    return true;
  }

  const allowedSiteIds = resolveCanvasingAllowedSiteIds(input.session);
  return getCanvasingSiteIds(input.canvasing).some((siteId) =>
    allowedSiteIds.includes(siteId),
  );
}

function getCanvasingSiteIds(canvasing: SiteScopedCanvasing): string[] {
  return [canvasing.user?.siteId, canvasing.mitra?.siteId].filter(
    (siteId): siteId is string => Boolean(siteId),
  );
}
