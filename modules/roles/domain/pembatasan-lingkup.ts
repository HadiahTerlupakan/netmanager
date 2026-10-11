/**
 * Pembatasan jangkauan data yang boleh tersimpan pada sebuah role.
 *
 * `site_only` dan `department_only` MENGURANGI jangkauan data. Halaman Hak
 * Akses hanya menggambar toggle untuk pembatasan yang ada di katalog
 * kapabilitas, jadi pembatasan di luar katalog tidak punya tombol: pemilik role
 * tidak bisa melihatnya, apalagi mematikannya.
 *
 * Yang membuatnya abadi adalah alur simpannya sendiri. Halaman memuat seluruh
 * `permissionList` role apa adanya, termasuk yang tak tergambar, lalu
 * mengirimkannya kembali saat disimpan. Sekali sebuah pembatasan tanpa toggle
 * masuk, setiap penyimpanan berikutnya menuliskannya ulang — selamanya.
 *
 * Kejadian nyata (produksi, 2026-10-07): 85 pasang resource:pembatasan tersebar
 * di 14 role tidak punya toggle sama sekali. Halaman Hak Akses terbaca "tidak
 * ada pembatasan yang menyala" padahal database menyimpan ratusan baris.
 *
 * Penjaga ini membuang pembatasan semacam itu saat role disimpan. Kemampuan
 * (read/create/update/...) tidak disentuh: matriks mobile memakai katalog aksi
 * yang berbeda, dan membuangnya akan mencabut izin yang sah.
 *
 * Katalognya sendiri hidup di `lib/resource-capabilities` — di luar domain.
 * Karena itu ia DISUNTIKKAN sebagai fungsi, bukan diimpor: lapisan domain
 * tidak boleh bergantung pada apa pun di luar dirinya
 * (`docs/architecture/clean-architecture.md`), dan aturan itu dijaga
 * `tests/architecture/domain-purity.test.ts`.
 */

/** Aksi yang dianggap pembatasan lingkup, bukan kemampuan. */
const AKSI_PEMBATASAN = ["site_only", "department_only"] as const;

export type AksiPembatasan = (typeof AKSI_PEMBATASAN)[number];

/**
 * Pencari aksi yang punya toggle untuk sebuah resource.
 *
 * Pemanggil di lapisan service menyuntikkan `getResourceCapabilities` dari
 * `lib/resource-capabilities`.
 */
export type AksiTersediaResource = (resource: string) => readonly string[];

function isAksiPembatasan(action: string): action is AksiPembatasan {
  return (AKSI_PEMBATASAN as readonly string[]).includes(action);
}

/** Pembatasan ini punya toggle di halaman Hak Akses, jadi boleh disimpan. */
export function isPembatasanPunyaToggle(
  permission: string,
  aksiTersedia: AksiTersediaResource,
): boolean {
  const [resource, action] = permission.split(":");
  if (!resource || !action || !isAksiPembatasan(action)) return true;
  return aksiTersedia(resource).includes(action);
}

/** Buang pembatasan yang tidak punya toggle; izin lain diteruskan apa adanya. */
export function buangPembatasanTanpaToggle(
  permissions: string[],
  aksiTersedia: AksiTersediaResource,
): string[] {
  return permissions.filter((permission) =>
    isPembatasanPunyaToggle(permission, aksiTersedia),
  );
}
