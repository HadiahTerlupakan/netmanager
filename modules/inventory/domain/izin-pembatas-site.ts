/**
 * Permission pembatas site untuk setiap endpoint inventory.
 *
 * Satu endpoint punya jalur daftar dan jalur tulis (buat, ubah, hapus). Dulu
 * keduanya menebak daftar pembatasnya sendiri-sendiri: daftar barang masuk
 * membaca `masuk:site_only`, sedangkan pencatatannya hanya `barang:` dan
 * `gudang:site_only`. Akibatnya role yang dibatasi lewat toggle "Barang Masuk"
 * tidak melihat mutasi site lain, tetapi tetap bisa mencatatnya. Daftar di sini
 * dipakai bersama oleh kedua jalur supaya mustahil berbeda lagi.
 *
 * Nama permission sengaja ditulis sebagai literal utuh agar tetap ditemukan
 * pencarian teks, termasuk oleh `tests/architecture/lingkup-site-konsisten.test.ts`.
 */

/**
 * Sumbu pembatasan yang berlaku untuk seluruh pergerakan stok.
 *
 * Setiap daftar inventory punya sumbunya sendiri (`masuk:`, `keluar:`,
 * `transfer:`, `opname:`), tetapi semuanya pada akhirnya berbicara tentang
 * gudang. Orang yang dibatasi per-site untuk gudang atau barang tidak
 * seharusnya melihat mutasi gudang site lain hanya karena sumbu spesifik mutasi
 * itu tidak dinyalakan admin.
 */
export const PEMBATASAN_SITE_GUDANG = [
  "barang:site_only",
  "gudang:site_only",
] as const;

/** Master barang dan stoknya. */
export const IZIN_PEMBATAS_BARANG: readonly string[] = PEMBATASAN_SITE_GUDANG;

/** Master gudang. */
export const IZIN_PEMBATAS_GUDANG: readonly string[] = PEMBATASAN_SITE_GUDANG;

/** Barang masuk: daftar, detail, pencatatan, ubah, hapus. */
export const IZIN_PEMBATAS_MASUK: readonly string[] = [
  "masuk:site_only",
  ...PEMBATASAN_SITE_GUDANG,
];

/** Barang keluar: daftar, detail, cek stok, pencatatan, ubah, hapus. */
export const IZIN_PEMBATAS_KELUAR: readonly string[] = [
  "keluar:site_only",
  ...PEMBATASAN_SITE_GUDANG,
];

/** Transfer antar gudang: daftar, detail, pencatatan, ubah, hapus. */
export const IZIN_PEMBATAS_TRANSFER: readonly string[] = [
  "transfer:site_only",
  ...PEMBATASAN_SITE_GUDANG,
];

/** Stock opname: daftar, statistik, laporan, hitung awal, pencatatan, ubah, hapus. */
export const IZIN_PEMBATAS_OPNAME: readonly string[] = [
  "opname:site_only",
  ...PEMBATASAN_SITE_GUDANG,
];

/**
 * Pengajuan restock. Daftarnya (`app/api/inventory/restock/requests`) hanya
 * membaca `restock:site_only`; detail dan aksi per pengajuan mengikutinya.
 */
export const IZIN_PEMBATAS_RESTOCK: readonly string[] = ["restock:site_only"];

const PEMISAH_IZIN = ":";

/**
 * Pasangan `{ resource, action }` dari `IZIN_PEMBATAS_OPNAME`, untuk menyaring
 * baris permission role di query. Diturunkan dari daftar yang sama dengan
 * daftar/CRUD opname supaya pengingat tidak bisa berbeda sumbu lagi.
 */
export const PASANGAN_PEMBATAS_OPNAME: ReadonlyArray<{
  resource: string;
  action: string;
}> = IZIN_PEMBATAS_OPNAME.map((izin) => {
  const [resource, action] = izin.split(PEMISAH_IZIN);
  return { resource, action };
});
