/**
 * Logika murni backfill `siteId` dari tautan site grup owner MixRadius.
 *
 * Dipisah dari runner `backfill-site-from-mixradius-groups.ts` supaya aturan
 * pemetaan bisa diuji tanpa database.
 */

const APPLY_FLAG = "--apply";
const REASON_INVESTOR_SITE_ONLY = "hanya punya site investor MixRadius";
const REASON_GROUP_NOT_FOUND = "grup MixRadius tidak ditemukan di DB billing";

/** Site internal (DB app) yang boleh dipakai sebagai hasil backfill. */
export interface InternalSite {
  id: string;
  tenantId: string | null;
}

/** Grup owner MixRadius (DB billing) beserta site internal yang ditautkan. */
export interface OwnerGroupSiteLink {
  id: string;
  name: string;
  siteId: string | null;
}

/** Row Expense/RAB tanpa `siteId` yang masih menyimpan rujukan MixRadius. */
export interface RecordWithoutSite {
  id: string;
  label: string;
  tenantId: string | null;
  mixRadiusGroupId: string | null;
}

export interface SiteAssignment {
  siteId: string;
  recordIds: string[];
}

export interface UnmappedRecord {
  id: string;
  label: string;
  reason: string;
}

export interface SiteBackfillPlan {
  assignments: SiteAssignment[];
  unmapped: UnmappedRecord[];
}

type SiteResolution = { siteId: string } | { reason: string };

/** Menentukan apakah skrip menulis ke database; tanpa `--apply` hanya dry-run. */
export function isApplyMode(args: string[]): boolean {
  return args.includes(APPLY_FLAG);
}

/** Menyusun rencana backfill: row terpetakan dikelompokkan per site, sisanya dilaporkan. */
export function planSiteBackfill(input: {
  records: RecordWithoutSite[];
  groups: OwnerGroupSiteLink[];
  sites: InternalSite[];
}): SiteBackfillPlan {
  const groupsById = new Map(input.groups.map((group) => [group.id, group]));
  const siteTenantById = new Map(
    input.sites.map((site) => [site.id, site.tenantId]),
  );
  const recordIdsBySite = new Map<string, string[]>();
  const unmapped: UnmappedRecord[] = [];

  for (const record of input.records) {
    const resolution = resolveSite(record, groupsById, siteTenantById);
    if ("reason" in resolution) {
      unmapped.push({ ...pickIdentity(record), reason: resolution.reason });
      continue;
    }

    const recordIds = recordIdsBySite.get(resolution.siteId) ?? [];
    recordIdsBySite.set(resolution.siteId, [...recordIds, record.id]);
  }

  return {
    assignments: [...recordIdsBySite].map(([siteId, recordIds]) => ({
      siteId,
      recordIds,
    })),
    unmapped,
  };
}

function resolveSite(
  record: RecordWithoutSite,
  groupsById: ReadonlyMap<string, OwnerGroupSiteLink>,
  siteTenantById: ReadonlyMap<string, string | null>,
): SiteResolution {
  if (!record.mixRadiusGroupId) return { reason: REASON_INVESTOR_SITE_ONLY };

  const group = groupsById.get(record.mixRadiusGroupId);
  if (!group) return { reason: REASON_GROUP_NOT_FOUND };

  const siteId = group.siteId?.trim();
  if (!siteId || !siteTenantById.has(siteId)) {
    return { reason: `grup "${group.name}" tidak tertaut ke site internal` };
  }

  if (siteTenantById.get(siteId) !== record.tenantId) {
    return { reason: `site grup "${group.name}" milik tenant lain` };
  }

  return { siteId };
}

function pickIdentity(record: RecordWithoutSite) {
  return { id: record.id, label: record.label };
}
