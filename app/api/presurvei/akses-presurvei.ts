/**
 * Penurunan kapabilitas pemanggil untuk route presurvei.
 *
 * Keempat route presurvei menerima permission web ATAU mobile (`createHandler`
 * memeriksanya dengan `.some()`). Role sales hanya memegang yang mobile, jadi
 * lolosnya gerbang permission belum berarti ia boleh melihat milik orang lain.
 * Berkas ini menampung satu-satunya definisi pembedanya supaya keempat route
 * tidak menuliskan ulang ekspresi yang sama.
 */

/** Permission web presurvei — pemegangnya melihat seluruh prospek tenant. */
const PERMISSION_LIHAT_SEMUA = "presurvei:read";

/** Wildcard super admin sebagaimana dipakai `lib/api/handler.ts`. */
const PERMISSION_WILDCARD = "*";

/**
 * Apakah pemanggil boleh melihat prospek dan kegiatan milik sales lain.
 *
 * Sengaja memeriksa string apa adanya, bukan lewat `hasCapability`: resolusi
 * alias bisa suatu saat memetakan permission mobile ke permission web, dan itu
 * akan melonggarkan pembatasan kepemilikan ini tanpa suara.
 */
export function isBolehLihatSemuaPresurvei(permissions: string[]): boolean {
  return (
    permissions.includes(PERMISSION_LIHAT_SEMUA) ||
    permissions.includes(PERMISSION_WILDCARD)
  );
}

/**
 * Tentukan pemilik prospek, mengabaikan `pemilikId` kiriman klien bila pemanggil
 * tidak berhak menugaskannya.
 *
 * `pemilikId` bukan sekadar data: ia yang menentukan siapa boleh membaca dan
 * mengubah prospek tersebut. Membiarkan klien menentukannya berarti sales bisa
 * membuat prospek atas nama rekan setimnya — mengotori laporan performa orang
 * lain — atau mengalihkan prospeknya sendiri ke orang lain dan kehilangan akses.
 * Hanya pemegang permission web yang boleh menugaskan pemilik.
 */
export function tentukanPemilikProspek(
  permissions: string[],
  pemilikDiminta: string | null | undefined,
  idPemanggil: string,
): string {
  if (!isBolehLihatSemuaPresurvei(permissions)) return idPemanggil;
  return pemilikDiminta ?? idPemanggil;
}
