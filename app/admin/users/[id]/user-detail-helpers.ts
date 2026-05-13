interface SelectedSite {
  siteId: string;
  isPrimary: boolean;
}

interface Site {
  id: string;
  code: string;
  name: string;
}

interface UserSiteRelation {
  id?: string;
  siteId?: string | null;
  isPrimary?: boolean | null;
  site?: { id?: string | null; code: string; name: string } | null;
}

interface UserDataLike {
  siteId: string | null;
  site?: { code: string; name: string } | null;
  userSites?: UserSiteRelation[];
}

const DEFAULT_SELECTED_SITE: SelectedSite[] = [];

/** Normalisasi selected sites agar tidak ada site ganda dan primary tetap konsisten. */
export function normalizeSelectedSites(sites: SelectedSite[]): SelectedSite[] {
  const siteMap = new Map<string, SelectedSite>();

  sites.forEach((site) => {
    if (!site.siteId) return;
    const currentSite = siteMap.get(site.siteId);
    siteMap.set(site.siteId, {
      siteId: site.siteId,
      isPrimary: Boolean(currentSite?.isPrimary || site.isPrimary),
    });
  });

  const normalizedSites = Array.from(siteMap.values());
  const hasPrimary = normalizedSites.some((site) => site.isPrimary);

  if (!hasPrimary && normalizedSites[0]) {
    normalizedSites[0] = { ...normalizedSites[0], isPrimary: true };
  }

  return normalizedSites;
}

/** Ambil site terpilih dari relasi multi-site atau fallback site tunggal. */
export function getSelectedSitesFromUser(user: UserDataLike): SelectedSite[] {
  if (user.userSites?.length) {
    return normalizeSelectedSites(
      user.userSites
        .map((userSite) => ({
          siteId: userSite.siteId || userSite.site?.id || "",
          isPrimary: userSite.isPrimary ?? false,
        }))
        .filter((site): site is SelectedSite => Boolean(site.siteId)),
    );
  }

  return user.siteId
    ? normalizeSelectedSites([{ siteId: user.siteId, isPrimary: true }])
    : DEFAULT_SELECTED_SITE;
}

/** Ambil daftar site dari user agar opsi edit tetap sinkron. */
export function getSitesFromUser(user: UserDataLike): Site[] {
  const relationSites =
    user.userSites
      ?.map((userSite) => userSite.site)
      .filter((site): site is Site => Boolean(site?.id)) ?? [];

  if (relationSites.length > 0) return relationSites;
  return user.siteId && user.site ? [{ id: user.siteId, ...user.site }] : [];
}

/** Gabungkan daftar site tanpa membuat duplikasi id. */
export function mergeSites(currentSites: Site[], nextSites: Site[]): Site[] {
  const siteMap = new Map(currentSites.map((site) => [site.id, site]));
  nextSites.forEach((site) => siteMap.set(site.id, site));
  return Array.from(siteMap.values());
}
