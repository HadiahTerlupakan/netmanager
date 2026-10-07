/**
 * Kontrak tunggal pembatasan data per site.
 *
 * Basis kode ini punya tiga cara berbeda menyatakan hal yang sama, dan dua di
 * antaranya salah dengan cara yang sama:
 *
 *   allowedSiteIds.length > 0 ? { siteId: { in: ... } } : {}   // kosong = SEMUA
 *   scope.siteId = dbUser?.siteId || ""                        // kosong = SEMUA
 *   if (access.userSiteId) { ... }                             // kosong = SEMUA
 *
 * Ketiganya membalik arti pembatasan: pengguna yang DIBATASI tetapi belum
 * ditugaskan ke site mana pun justru melihat seluruh tenant. Diam-diam, dan
 * persis pada pengguna yang paling tidak diharapkan melihatnya.
 *
 * Tipe di bawah membuat kekeliruan itu tidak bisa ditulis: "dibatasi" dan
 * "daftar site" datang sebagai satu nilai, sehingga tidak ada jalan membaca
 * daftar kosong tanpa lebih dulu mengakui bahwa pengguna memang dibatasi.
 */

export type LingkupSite =
  | { dibatasi: false }
  | { dibatasi: true; siteIds: readonly string[] };

export const TANPA_BATAS: LingkupSite = { dibatasi: false };

interface LingkupSiteInput {
  permissions: readonly string[];
  resource: string;
  /** Site pengguna: site utama digabung seluruh site tambahannya. */
  siteIds: readonly string[];
  isSuperAdmin: boolean;
}

/** Lingkup site seorang pengguna untuk satu resource. */
export function lingkupSiteUntuk(input: LingkupSiteInput): LingkupSite {
  if (input.isSuperAdmin) return TANPA_BATAS;
  if (!input.permissions.includes(`${input.resource}:site_only`)) {
    return TANPA_BATAS;
  }
  return { dibatasi: true, siteIds: [...new Set(input.siteIds)] };
}

/**
 * Pengguna dibatasi tetapi tidak punya site sama sekali — tidak ada data yang
 * boleh ia lihat.
 *
 * Pemanggil WAJIB memeriksa ini sebelum membangun query. Mengabaikannya berarti
 * kembali ke gagal-terbuka yang jadi alasan berkas ini ada.
 */
export function tanpaDataSamaSekali(lingkup: LingkupSite): boolean {
  return lingkup.dibatasi && lingkup.siteIds.length === 0;
}

/**
 * Klausa Prisma `{ in: [...] }` untuk kolom site, atau `undefined` bila tidak
 * dibatasi. Melempar bila dipanggil pada lingkup kosong, supaya pemanggil yang
 * lupa memeriksa `tanpaDataSamaSekali` gagal keras alih-alih membocorkan data.
 */
export function filterSitePrisma(
  lingkup: LingkupSite,
): { in: string[] } | undefined {
  if (!lingkup.dibatasi) return undefined;
  if (lingkup.siteIds.length === 0) {
    throw new Error(
      "Lingkup site kosong: periksa tanpaDataSamaSekali() sebelum membangun query",
    );
  }
  return { in: [...lingkup.siteIds] };
}

/** Apakah satu site tertentu boleh diakses dalam lingkup ini. */
export function siteBolehDiakses(
  lingkup: LingkupSite,
  siteId: string | null | undefined,
): boolean {
  if (!lingkup.dibatasi) return true;
  if (!siteId) return false;
  return lingkup.siteIds.includes(siteId);
}
