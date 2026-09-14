/**
 * Penanda pembuat baris `app_updates` yang datang dari pipeline, bukan dari UI
 * admin.
 *
 * Nilainya ikut tersimpan di basis data, jadi ia ditaruh di satu tempat supaya
 * dua jalur publish — route Next.js dan handler custom server — tidak pernah
 * menulis penanda yang berbeda untuk sumber yang sama.
 *
 * Baris lama masih bertanda `ci:jenkins`. Nilai ini murni metadata tampilan dan
 * tidak pernah dipakai memfilter, jadi riwayatnya dibiarkan apa adanya: baris
 * itu memang diterbitkan Jenkins.
 */
export const CI_PUBLISHER_ID = "ci:gitea";
