import { isSuperAdmin } from "@/lib/auth";
import { hasPermissionWithAlias } from "@/lib/permission-aliases";

/**
 * Permission set untuk route yang menyentuh data tagihan pelanggan.
 *
 * `createHandler` mengevaluasi daftar permission sebagai OR. Daftar baca
 * mencakup seluruh gerbang halaman yang memang sudah memakai endpoint terkait —
 * `/admin/finance/**` (`finance:read`) maupun `/admin/pelanggan/**`
 * (`pelanggan:read` / `ppp:read`) — agar principal tanpa kapabilitas finansial
 * sama sekali (mis. token mobile Teknisi yang hanya punya permission `m_*`)
 * tertutup tanpa mengunci pengguna yang selama ini sah.
 */
export const INVOICE_READ_PERMISSIONS: string[] = [
  "finance:read",
  "pelanggan:read",
  "ppp:read",
];

/**
 * Operasi tulis invoice menuntut permission tingkat ubah, bukan sekadar baca.
 *
 * Sebelumnya set ini disamakan dengan set baca, sehingga siapa pun yang boleh
 * MEMBACA pelanggan juga boleh menulis ulang atau menghapus invoice. Satu-satunya
 * konsumen yang benar-benar menulis invoice adalah halaman perpanjangan
 * (`app/admin/pelanggan/ppp/[id]/renew`), yang sudah digerbangi
 * `ensurePermission('pelanggan:update')` — jadi menuntut permission ubah di sini
 * tidak mengunci alur mana pun yang hari ini berjalan.
 */
export const INVOICE_WRITE_PERMISSIONS: string[] = [
  "finance:update",
  "pelanggan:update",
  "ppp:update",
  "transactions:update",
];

/** Permission yang menandai pembatasan cakupan site untuk data invoice. */
const INVOICE_SITE_ONLY_PERMISSION = "invoices:site_only";

/**
 * Menentukan apakah pemanggil hanya boleh melihat invoice site-nya sendiri.
 *
 * Membaca permission dari context handler, bukan dari sesi NextAuth. Versi
 * sebelumnya memanggil `hasPermission()` tanpa argumen user sehingga jatuh ke
 * `getServerSession`; untuk pemanggil Bearer (token mobile) sesi itu null dan
 * fungsinya selalu mengembalikan false — pembatas site justru mati bagi
 * pemanggil yang paling tidak dipercaya. `ctx.permissions` terisi untuk kedua
 * jalur autentikasi, jadi pembatasnya kini berlaku seragam.
 */
export function isInvoiceSiteRestricted(options: {
  permissions: string[];
  user: { role?: string | null; isSuperAdmin?: boolean | null };
}): boolean {
  if (isSuperAdmin(options.user as Parameters<typeof isSuperAdmin>[0])) {
    return false;
  }

  return hasPermissionWithAlias(
    options.permissions,
    INVOICE_SITE_ONLY_PERMISSION,
  );
}
