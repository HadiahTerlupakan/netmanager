/**
 * Set permission untuk operasi tulis kas & bank.
 *
 * `createHandler` menilai daftar permission sebagai OR (lihat `lib/api/handler.ts`,
 * `expandedPerms.some(...)`), jadi satu entri `:read` pada route tulis membuat hak
 * baca setara hak tulis. Set di bawah ini sengaja hanya berisi permission tingkat
 * tulis.
 *
 * Konstanta yang sama dipakai route API dan gerbang tombol di UI supaya keduanya
 * tidak bisa berbeda. Sebelumnya tombol "Mutasi Saldo" dan "Tambah Akun Baru"
 * digerbangi `expense:create` sementara API menuntut `treasury:*`, sehingga
 * pengguna bisa melihat tombol yang pasti ditolak server — dan sebaliknya,
 * pemegang `treasury:*` tanpa `expense:create` tidak melihat tombolnya sama sekali.
 *
 * Diverifikasi terhadap data role produksi (2026-09-19): `treasury:create` dan
 * `treasury:update` dipegang role `admin`; `finance:update` dipegang `admin` dan
 * `Super Admin`. Keduanya tetap bisa mengelola kas setelah pengetatan ini, dan
 * tidak ada alur berjalan yang putus — fitur mutasi saldo belum pernah dipakai
 * (0 log `TRANSFER` di produksi).
 */
export const TREASURY_ACCOUNT_CREATE_PERMISSIONS: string[] = [
  "treasury:create",
  "finance:update",
];

/** Memindahkan dana antar akun kas/bank. */
export const TREASURY_TRANSFER_PERMISSIONS: string[] = [
  "treasury:update",
  "finance:update",
];

/** Membayar purchase order dari saldo akun kas/bank. */
export const PURCHASE_ORDER_PAYMENT_PERMISSIONS: string[] = [
  "finance:update",
  "treasury:update",
];
