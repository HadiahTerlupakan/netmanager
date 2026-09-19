/**
 * Site yang boleh diakses seorang karyawan, dipakai bersama oleh
 * `modules/pelanggan` dan `modules/work-order` (hidup di `lib/`, bukan salah
 * satu module, karena import lintas-module dilarang oleh Module Boundary).
 *
 * `siteIds` (hasil migrasi ke tabel `userSites`) adalah sumber utama.
 * `verifyMobileToken` (`lib/mobile-auth.ts`) SELALU mengisi `siteIds` sebagai
 * array — untuk karyawan yang belum pernah dimigrasi ke `userSites`, itu
 * berarti `siteIds: []` (bukan `undefined`), dengan `siteId` legacy tetap
 * terisi. Fungsi ini sengaja memakai `siteIds?.length` (bukan `??`) supaya
 * array kosong tetap jatuh ke fallback `siteId` legacy — `??` tidak pernah
 * jatuh ke fallback untuk `[]` karena array kosong bukan `null`/`undefined`.
 */
export function resolveAllowedSiteIds(user: {
  siteId?: string | null;
  siteIds?: string[];
}): string[] {
  if (user.siteIds?.length) return user.siteIds;
  return user.siteId ? [user.siteId] : [];
}
