import { signOut } from "next-auth/react";

/**
 * Logout yang kembali ke halaman login portal yang sedang dibuka.
 *
 * `signOut()` tanpa `callbackUrl` memakai origin `NEXTAUTH_URL`, yang di
 * produksi adalah apex — pengguna yang logout dari `admin.radpro.id` mendarat
 * di landing page, bukan di halaman login admin.
 */

const ADMIN_LOGIN_PATH = "/admin/login";
const EMPLOYEE_LOGIN_PATH = "/karyawan/login";
const EMPLOYEE_PATH_PREFIX = "/karyawan";

/** Halaman login milik portal yang sedang dibuka. */
export function resolveLoginPath(pathname: string): string {
  return pathname.startsWith(EMPLOYEE_PATH_PREFIX)
    ? EMPLOYEE_LOGIN_PATH
    : ADMIN_LOGIN_PATH;
}

/** URL absolut ke halaman login pada host yang sedang dipakai. */
export function buildSignOutCallbackUrl(
  origin: string,
  pathname: string,
): string {
  return `${origin}${resolveLoginPath(pathname)}`;
}

/** Mengakhiri sesi lalu kembali ke halaman login portal ini. */
export function signOutToPortalLogin(): Promise<undefined> {
  const { origin, pathname } = window.location;
  return signOut({ callbackUrl: buildSignOutCallbackUrl(origin, pathname) });
}
