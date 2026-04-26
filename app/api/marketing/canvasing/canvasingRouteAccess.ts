type SiteScopedSession = {
  siteId?: string | null;
};

type SiteScopedCanvasing = {
  user?: { siteId: string | null } | null;
  mitra?: { siteId: string | null } | null;
};

export function canAccessCanvasingSite(
  isSuperAdmin: boolean,
  permissions: string[],
  session: SiteScopedSession,
  canvasing: SiteScopedCanvasing,
): boolean {
  if (isSuperAdmin || !permissions.includes("canvasing:site_only")) {
    return true;
  }

  return getCanvasingSiteIds(canvasing).includes(session.siteId ?? "");
}

function getCanvasingSiteIds(canvasing: SiteScopedCanvasing): string[] {
  return [canvasing.user?.siteId, canvasing.mitra?.siteId].filter(
    (siteId): siteId is string => Boolean(siteId),
  );
}
