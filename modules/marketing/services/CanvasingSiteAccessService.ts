interface SiteScopedSession {
  siteId?: string | null;
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

  return getCanvasingSiteIds(input.canvasing).includes(
    input.session.siteId ?? "",
  );
}

function getCanvasingSiteIds(canvasing: SiteScopedCanvasing): string[] {
  return [canvasing.user?.siteId, canvasing.mitra?.siteId].filter(
    (siteId): siteId is string => Boolean(siteId),
  );
}
