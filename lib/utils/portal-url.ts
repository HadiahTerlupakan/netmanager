import { getPublicSiteUrl } from "./env";

/**
 * URL portal admin dari sudut pandang situs publik.
 *
 * Landing page berjalan di apex, sedangkan portal admin punya host sendiri.
 * `proxy.ts` sudah menambahkan prefix `/admin` untuk setiap path di host itu,
 * jadi alamat kanoniknya `https://admin.<domain>/login` — bukan
 * `https://<domain>/admin/login`, yang memaksa pengguna login di host yang
 * bukan tempat portalnya berjalan.
 */

const ADMIN_PATH_PREFIX = "/admin";
const ADMIN_SUBDOMAIN = "admin";
const STAGING_ADMIN_SUBDOMAIN = "admin-staging";
const STAGING_PREFIX = "staging.";
const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1"];

/** Host portal admin untuk sebuah host publik. */
export function buildAdminPortalHostname(hostname: string): string {
  if (
    hostname.startsWith(`${ADMIN_SUBDOMAIN}.`) ||
    hostname.startsWith(`${STAGING_ADMIN_SUBDOMAIN}.`)
  ) {
    return hostname;
  }

  if (LOCAL_HOSTNAMES.includes(hostname)) {
    return `${ADMIN_SUBDOMAIN}.localhost`;
  }

  // Staging memakai satu label gabungan (`admin-staging.<domain>`) karena
  // sertifikat wildcard hanya menutup satu tingkat subdomain.
  if (hostname.startsWith(STAGING_PREFIX)) {
    return `${STAGING_ADMIN_SUBDOMAIN}.${hostname.slice(STAGING_PREFIX.length)}`;
  }

  return `${ADMIN_SUBDOMAIN}.${hostname}`;
}

/** URL absolut ke portal admin; default ke halaman login. */
export function getAdminPortalUrl(path: string = "/login"): string {
  const publicSiteUrl = getPublicSiteUrl();

  // Tanpa env URL, tidak ada host yang bisa diturunkan — pertahankan tautan
  // relatif yang tetap bekerja di apex.
  if (publicSiteUrl === "/") {
    return path === "/" ? ADMIN_PATH_PREFIX : `${ADMIN_PATH_PREFIX}${path}`;
  }

  const url = new URL(publicSiteUrl);
  url.hostname = buildAdminPortalHostname(url.hostname);
  url.pathname = path;

  return url.toString();
}

/**
 * Mengubah tautan `/admin/*` menjadi URL portal admin.
 *
 * Dipakai juga untuk tautan yang datang dari database (konten landing bisa
 * disunting), sehingga nilai lama `/admin/login` tetap mengarah ke host portal.
 */
export function resolveAdminPortalHref(href: string): string {
  if (href !== ADMIN_PATH_PREFIX && !href.startsWith(`${ADMIN_PATH_PREFIX}/`)) {
    return href;
  }

  return getAdminPortalUrl(href.slice(ADMIN_PATH_PREFIX.length) || "/");
}
