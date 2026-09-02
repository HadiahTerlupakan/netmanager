import { logger } from "@/lib/logger";

export type RbacPrincipal = {
  id?: string;
  role?: string;
  isSuperAdmin?: boolean;
} | null;

/**
 * Menentukan principal untuk pengecekan permission.
 *
 * `hasPermission()` semula hanya mencoba `getServerSession`. Untuk pemanggil
 * Bearer (token mobile karyawan) sesi itu null, sehingga fungsi SELALU
 * mengembalikan false. Dua akibatnya berlawanan arah:
 *
 * - Pembatas cakupan (`*:site_only`) menjadi MATI — pemanggil Bearer melihat
 *   data lebih luas dari yang seharusnya. Ini kebocoran data.
 * - Gerbang kapabilitas selalu menolak — endpoint tidak bisa dipakai dari
 *   mobile sama sekali.
 *
 * Urutannya sengaja: argumen eksplisit menang, lalu sesi, baru token Bearer.
 * Kegagalan resolusi Bearer tidak dilempar — `hasPermission` dipakai di ratusan
 * tempat dan harus tetap fail-closed, bukan meledak.
 */
export async function resolveRbacPrincipal(options: {
  explicitUser?: RbacPrincipal;
  getSessionUser: () => Promise<RbacPrincipal>;
  getBearerUser: () => Promise<RbacPrincipal>;
}): Promise<RbacPrincipal> {
  if (options.explicitUser) {
    return options.explicitUser;
  }

  const sessionUser = await options.getSessionUser();
  if (sessionUser) {
    return sessionUser;
  }

  try {
    return (await options.getBearerUser()) ?? null;
  } catch (error) {
    logger.error(
      "[RBAC] Gagal menyelesaikan principal dari token Bearer:",
      error,
    );
    return null;
  }
}
