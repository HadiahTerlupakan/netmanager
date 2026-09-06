/**
 * URL situs publik dan URL portal.
 *
 * Landing page berjalan di apex, sedangkan tiap portal punya host sendiri.
 * `proxy.ts` sudah menambahkan prefix portal untuk setiap path di host itu,
 * jadi alamat kanonik portal admin adalah `https://admin.<domain>/login` —
 * bukan `https://<domain>/admin/login`, yang memaksa pengguna login di host
 * yang bukan tempat portalnya berjalan.
 */

const ADMIN_PATH_PREFIX = "/admin";
const ADMIN_SUBDOMAIN = "admin";
const STAGING_LABEL = "staging";
const STAGING_SUFFIX = `-${STAGING_LABEL}`;
const STAGING_PREFIX = `${STAGING_LABEL}.`;
const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1"];

/** Label subdomain yang dikenali `proxy.ts` sebagai portal, bukan tenant. */
const PORTAL_SUBDOMAINS = ["admin", "karyawan", "investor", "pelanggan"];

function splitFirstLabel(hostname: string): [string, string] | null {
  const separatorIndex = hostname.indexOf(".");
  if (separatorIndex === -1) return null;

  return [
    hostname.slice(0, separatorIndex),
    hostname.slice(separatorIndex + 1),
  ];
}

/**
 * Host situs publik untuk sebuah host portal.
 *
 * Subdomain slug milik tenant (`acme.<domain>`) dibiarkan apa adanya: situs
 * publiknya memang host itu sendiri, bukan apex.
 */
export function stripPortalSubdomain(hostname: string): string {
  const parts = splitFirstLabel(hostname);
  if (!parts) return hostname;

  const [label, remainder] = parts;

  if (PORTAL_SUBDOMAINS.includes(label)) return remainder;

  if (
    label.endsWith(STAGING_SUFFIX) &&
    PORTAL_SUBDOMAINS.includes(label.slice(0, -STAGING_SUFFIX.length))
  ) {
    return `${STAGING_PREFIX}${remainder}`;
  }

  return hostname;
}

/**
 * URL situs publik (apex), tempat landing page berada.
 *
 * Nilai `NEXT_PUBLIC_*` disisipkan saat image dibangun, dan build ini tidak
 * menerima `NEXT_PUBLIC_APP_URL` sebagai build arg — jadi di bundel klien
 * nilainya undefined meski server membacanya dari configmap saat runtime.
 * Origin halaman adalah sumber yang sama benarnya, dan satu-satunya yang juga
 * benar untuk domain kustom milik tenant.
 *
 * Berbeda dari `getAppUrl()`, fungsi ini tidak melempar error: pemakainya
 * hanya menampilkan atau menautkan URL.
 */
export function getPublicSiteUrl(): string {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;

  if (configuredUrl && configuredUrl !== "undefined") {
    return configuredUrl.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    const url = new URL(window.location.origin);
    url.hostname = stripPortalSubdomain(url.hostname);
    return url.origin;
  }

  return "/";
}

/** Host portal admin untuk sebuah host publik. */
export function buildAdminPortalHostname(hostname: string): string {
  if (
    hostname.startsWith(`${ADMIN_SUBDOMAIN}.`) ||
    hostname.startsWith(`${ADMIN_SUBDOMAIN}${STAGING_SUFFIX}.`)
  ) {
    return hostname;
  }

  if (LOCAL_HOSTNAMES.includes(hostname)) {
    return `${ADMIN_SUBDOMAIN}.localhost`;
  }

  // Staging memakai satu label gabungan (`admin-staging.<domain>`) karena
  // sertifikat wildcard hanya menutup satu tingkat subdomain.
  if (hostname.startsWith(STAGING_PREFIX)) {
    return `${ADMIN_SUBDOMAIN}${STAGING_SUFFIX}.${hostname.slice(STAGING_PREFIX.length)}`;
  }

  return `${ADMIN_SUBDOMAIN}.${hostname}`;
}

/** URL absolut ke portal admin; default ke halaman login. */
export function getAdminPortalUrl(path: string = "/login"): string {
  const publicSiteUrl = getPublicSiteUrl();

  // Tanpa env URL maupun origin halaman, tidak ada host yang bisa diturunkan —
  // pertahankan tautan relatif yang tetap bekerja di apex.
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
