/**
 * Lingkup site `workorders:site_only` di lapisan query.
 *
 * Lingkup dikirim sebagai daftar SELURUH site pengguna (site utama + site
 * tambahan dari `userSites`), atau `undefined` bila pengguna tidak dibatasi.
 * Dulu lingkup ini berupa satu `siteId`, sehingga karyawan multi-site di panel
 * web hanya melihat WO site utamanya sementara mobile/inventory memakai semua
 * site-nya. Daftar kosong berarti tidak ada WO yang boleh dilihat.
 */
export type WorkOrderSiteScope = readonly string[] | undefined;

/** Klausa Prisma untuk lingkup site saja (tanpa filter site pilihan pengguna). */
export function buildSiteScopeWhere(siteIds: WorkOrderSiteScope): {
  siteId?: { in: string[] };
} {
  return siteIds ? { siteId: { in: [...siteIds] } } : {};
}

/**
 * Gabungkan filter site pilihan pengguna (`siteId`) dengan lingkup site-nya
 * (`siteIds`). Site pilihan di luar lingkup tidak pernah melebarkan hasil:
 * filternya menjadi `{ in: [] }` (tidak ada baris).
 */
export function resolveSiteFilter(input: {
  siteId?: string;
  siteIds?: WorkOrderSiteScope;
}): string | { in: string[] } | undefined {
  if (!input.siteIds) return input.siteId;
  if (!input.siteId) return { in: [...input.siteIds] };
  return input.siteIds.includes(input.siteId) ? input.siteId : { in: [] };
}

/** Daftar site efektif untuk SQL mentah; `undefined` berarti tanpa filter site. */
export function resolveSiteIdList(input: {
  siteId?: string;
  siteIds?: WorkOrderSiteScope;
}): string[] | undefined {
  const filter = resolveSiteFilter(input);
  if (filter === undefined) return undefined;
  return typeof filter === "string" ? [filter] : filter.in;
}
