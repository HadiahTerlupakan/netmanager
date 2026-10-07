import {
  getResourceCapabilities,
  type ResourceAction,
} from "@/lib/resource-capabilities";

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
 */

const SCOPE_ACTIONS: readonly ResourceAction[] = [
  "site_only",
  "department_only",
];

function isScopeAction(action: string): action is ResourceAction {
  return (SCOPE_ACTIONS as readonly string[]).includes(action);
}

/** Pembatasan ini punya toggle di halaman Hak Akses, jadi boleh disimpan. */
export function isPembatasanPunyaToggle(permission: string): boolean {
  const [resource, action] = permission.split(":");
  if (!resource || !action || !isScopeAction(action)) return true;
  return getResourceCapabilities(resource).includes(action);
}

/** Buang pembatasan yang tidak punya toggle; izin lain diteruskan apa adanya. */
export function buangPembatasanTanpaToggle(permissions: string[]): string[] {
  return permissions.filter(isPembatasanPunyaToggle);
}
