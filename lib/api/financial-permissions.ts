/**
 * Permission set untuk route yang menyentuh data tagihan pelanggan.
 *
 * `createHandler` mengevaluasi daftar permission sebagai OR, jadi daftar ini
 * dipilih agar mencakup seluruh gerbang halaman yang memang sudah memakai
 * endpoint terkait — halaman `/admin/finance/**` (`finance:read`) maupun
 * `/admin/pelanggan/**` (`pelanggan:read` / `ppp:read`). Tujuannya menutup
 * akses principal tanpa kapabilitas finansial sama sekali (mis. token mobile
 * Teknisi yang hanya punya permission `m_*`) tanpa mengunci pengguna yang
 * selama ini sah memakai fitur tersebut.
 */
export const INVOICE_READ_PERMISSIONS: string[] = [
  "finance:read",
  "pelanggan:read",
  "ppp:read",
];

/**
 * Operasi tulis invoice. Untuk sekarang sengaja sama dengan set baca:
 * belum ada role template yang memegang `invoices:*`, sehingga memakai
 * permission tulis khusus akan mengunci staf yang hari ini bisa memakai
 * halaman perpanjangan. Pengetatan menyusul setelah permission tulis
 * benar-benar diberikan ke role terkait.
 */
export const INVOICE_WRITE_PERMISSIONS: string[] = [
  ...INVOICE_READ_PERMISSIONS,
];
