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
  name: string | null;
  email: string;
}

/** Identitas sales hasil join, beserta tenant pemiliknya untuk dijaga. */
export interface IdentitasSalesBertenant extends IdentitasSales {
  tenantId: string | null;
}

/**
 * Label seorang sales: `name` bila terisi, selain itu `email`.
 *
 * `User.name` bertipe `String?` dan bisa kosong; model `User` tidak punya
 * kolom `username`. `email` wajib dan unik, jadi dua sales tanpa nama tetap
 * bisa dibedakan di dropdown — label tetap seperti "Tanpa nama" akan membuat
 * keduanya kembar. Nama yang hanya berisi spasi diperlakukan kosong.
 */
export function tentukanNamaSales(identitas: IdentitasSales): string {
  const nama = identitas.name?.trim() ?? "";
  return nama.length > 0 ? nama : identitas.email;
}

/**
 * Label sales dari hasil join, atau null bila tidak boleh ditampilkan.
 *
 * Join ke `User` lewat `include` tidak disaring ekstensi tenant — ekstensi
 * hanya menulis ulang `where` level atas (`lib/prisma-extension.ts`, blok
 * "Automatic Filter Injection") — dan relasi ke-satu tidak menerima `where`
 * sama sekali. Maka baris yang menunjuk sales tenant lain (kelas data yang
 * pernah lahir dari handler pendaftaran tanpa penjaga tenant) akan membawa
 * nama orang di luar tenant. Penjaganya di sini: nama hanya dipakai bila
 * tenant sales sama persis dengan tenant baris yang merujuknya.
 */
export function namaSalesSatuTenant(
  identitas: IdentitasSalesBertenant | null | undefined,
  tenantIdBaris: string | null,
): string | null {
  if (!identitas) return null;
  if (identitas.tenantId !== tenantIdBaris) return null;
  return tentukanNamaSales(identitas);
}
