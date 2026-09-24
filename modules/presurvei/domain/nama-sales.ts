/**
 * Aturan tampilan nama sales di seluruh layar presurvei.
 *
 * Murni: tidak mengimpor apa pun dari luar folder domain.
 *
 * Satu definisi dipakai dua jalur — nama pada baris daftar (lewat join di
 * repository) dan daftar sales untuk dropdown — supaya orang yang sama tidak
 * tampil dengan dua label berbeda di layar yang sama.
 */

/** Kolom `User` yang dibutuhkan untuk menentukan label seorang sales. */
export interface IdentitasSales {
  id: string;
  name: string | null;
}

/** Awalan label sales yang `name`-nya kosong. */
export const LABEL_TANPA_NAMA = "Tanpa nama";

/**
 * Panjang potongan id yang ikut di label sales tanpa nama.
 *
 * Diambil dari UJUNG id: cuid diawali cap waktu, jadi dua user yang dibuat
 * berdekatan berbagi awalan yang sama, sedangkan ujungnya acak. Enam karakter
 * cukup untuk membedakan segelintir sales tanpa nama dalam satu tenant.
 */
const PANJANG_POTONGAN_ID = 6;

/** Identitas sales hasil join, beserta tenant pemiliknya untuk dijaga. */
export interface IdentitasSalesBertenant extends IdentitasSales {
  tenantId: string | null;
}

/**
 * Label seorang sales: `name` bila terisi, selain itu "Tanpa nama (…xxxxxx)".
 *
 * `User.name` bertipe `String?` dan bisa kosong; model `User` tidak punya
 * kolom `username`. Email sengaja TIDAK dipakai sebagai cadangan: pemegang
 * permission presurvei belum tentu berhak melihat email rekannya (sebelumnya
 * hanya terbuka lewat `users:read`/`sales:read`), dan menampilkan nama tidak
 * boleh sekaligus memperluas akses data pribadi. Potongan ujung id membuat dua
 * sales tanpa nama tetap bisa dibedakan di dropdown tanpa membuka apa pun
 * yang belum terlihat — id sudah ada di DTO. Nama yang hanya berisi spasi
 * diperlakukan kosong.
 */
export function tentukanNamaSales(identitas: IdentitasSales): string {
  const nama = identitas.name?.trim() ?? "";
  if (nama.length > 0) return nama;
  return `${LABEL_TANPA_NAMA} (…${identitas.id.slice(-PANJANG_POTONGAN_ID)})`;
}

/**
 * Label sales dari hasil join, atau null bila tidak boleh ditampilkan.
 *
 * Join ke `User` lewat `include` tidak disaring ekstensi tenant — ekstensi
 * hanya menulis ulang `where` level atas (`lib/prisma-extension.ts`, blok
 * "Automatic Filter Injection"). Maka baris yang menunjuk sales tenant lain
 * (kelas data yang pernah lahir dari handler pendaftaran tanpa penjaga
 * tenant) akan membawa nama orang di luar tenant.
 *
 * Penjaganya per baris, bukan `where` literal di `include`: untuk super admin
 * ekstensi tidak menyaring sama sekali (`lib/prisma-extension.ts`,
 * `isNonSuperAdminTenant`), jadi baris dari banyak tenant tercampur dalam satu
 * hasil — sementara tenant konteksnya null di system context
 * (`runAsSystemContext` di `lib/tenant-context.ts`) atau tenant
 * sesi super admin sendiri. Satu literal tidak bisa benar untuk semua baris
 * itu: ia akan menyembunyikan nama sales sah di tenant lain. Membandingkan tenant
 * sales dengan `tenantId` baris yang merujuknya benar di semua konteks.
 */
export function namaSalesSatuTenant(
  identitas: IdentitasSalesBertenant | null | undefined,
  tenantIdBaris: string | null,
): string | null {
  if (!isSatuTenant(identitas, tenantIdBaris)) return null;
  return tentukanNamaSales(identitas);
}

/**
 * Apakah user hasil join boleh ditampilkan pada baris bertenant
 * `tenantIdBaris` — penjaga tunggal untuk nama, peran, dan departemen pelaku
 * (`peran-pelaku.ts`), supaya ketiganya tidak pernah berbeda pendapat.
 */
export function isSatuTenant(
  identitas: IdentitasSalesBertenant | null | undefined,
  tenantIdBaris: string | null,
): boolean {
  if (!identitas) return false;
  return identitas.tenantId === tenantIdBaris;
}
