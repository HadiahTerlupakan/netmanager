/**
 * Keputusan akses presurvei yang diturunkan dari daftar permission role —
 * fungsi murni, tanpa I/O.
 *
 * Semua fungsi memeriksa string `resource:action` apa adanya, bukan lewat
 * `hasCapability`: resolusi alias bisa suatu saat memetakan permission mobile
 * ke permission web dan diam-diam melonggarkan pembatasan di sini.
 *
 * Murni (tanpa Prisma) agar aman dipakai client component lewat
 * `@/modules/roles/client` (form role memakai `isKepalaSalesDariIzin`).
 */

/** Jenis lingkup data sales yang boleh dilihat/diatur seorang pengguna. */
export type JenisLingkupPresurvei = "SEMUA" | "TIM" | "SENDIRI";

/** Wildcard super admin sebagaimana dipakai `lib/api/handler.ts`. */
const IZIN_WILDCARD = "*";
/** Permission web rencana yang membuka seluruh tenant (admin). */
const IZIN_RENCANA_SEMUA = "presurvei_rencana:view_all";
/**
 * Permission web yang membuat seseorang benar-benar bisa menugaskan rencana ke
 * sales lain — penanda kepala sales (lingkup tim).
 *
 * Sengaja izin `create`, bukan sekadar awalan `presurvei_rencana:`. Dengan
 * awalan, role yang hanya memegang `:read` ikut dianggap kepala sales: ia
 * mendapat tema dan kartu tim lengkap dengan tombol "Buat Rencana", padahal
 * penugasannya pasti ditolak 403. Lingkup tim kini berarti memang berwenang
 * menugaskan.
 */
const IZIN_RENCANA_TUGASKAN = "presurvei_rencana:create";
/** Permission web presurvei — pemegangnya melihat seluruh prospek tenant. */
const IZIN_LIHAT_SEMUA_PRESURVEI = "presurvei:read";
/** Permission laporan pencapaian — pemegangnya sudah melihat capaian seluruh sales. */
const IZIN_LAPORAN_PRESURVEI = "presurvei_laporan:read";

/**
 * Jenis lingkup rencana dari daftar permission `resource:action`.
 *
 * - SEMUA: `presurvei_rencana:view_all` atau wildcard (admin).
 * - TIM: `presurvei_rencana:create` tanpa `view_all` (kepala sales).
 * - SENDIRI: hanya permission mobile (sales).
 *
 * Satu definisi untuk route API, lingkup data sales, dan profil mobile.
 */
export function jenisLingkupDariIzin(
  permissions: string[],
): JenisLingkupPresurvei {
  if (
    permissions.includes(IZIN_WILDCARD) ||
    permissions.includes(IZIN_RENCANA_SEMUA)
  ) {
    return "SEMUA";
  }
  if (permissions.includes(IZIN_RENCANA_TUGASKAN)) {
    return "TIM";
  }
  return "SENDIRI";
}

/**
 * Apakah daftar izin role menandai kepala sales (lingkup rencana TIM).
 *
 * Ini BUKAN penentu "siapa sales": satu-satunya penentu sales adalah persona
 * role (`isSalesDariPersona`). Dipakai form role untuk menyarankan persona
 * Sales bagi role kepala sales.
 */
export function isKepalaSalesDariIzin(permissions: string[]): boolean {
  return jenisLingkupDariIzin(permissions) === "TIM";
}

/**
 * Lingkup penilaian kinerja: sama dengan rencana, kecuali pemegang laporan
 * pencapaian (tanpa izin rencana) melihat seluruh tenant — ia sudah melihat
 * angka capaian semua sales di Laporan Pencapaian.
 */
export function jenisLingkupPenilaian(
  permissions: string[],
): JenisLingkupPresurvei {
  const jenis = jenisLingkupDariIzin(permissions);
  if (jenis === "SENDIRI" && permissions.includes(IZIN_LAPORAN_PRESURVEI))
    return "SEMUA";
  return jenis;
}

/**
 * Apakah pemanggil boleh melihat prospek dan kegiatan presurvei milik sales
 * lain: pemegang permission web `presurvei:read` atau super admin (wildcard).
 * Role sales hanya memegang permission mobile, jadi lolosnya gerbang
 * permission route belum berarti ia boleh melihat milik orang lain.
 */
export function isBolehLihatSemuaPresurvei(permissions: string[]): boolean {
  return (
    permissions.includes(IZIN_LIHAT_SEMUA_PRESURVEI) ||
    permissions.includes(IZIN_WILDCARD)
  );
}
