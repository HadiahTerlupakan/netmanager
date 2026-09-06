import { cookies as authCookies } from "./cookies";

/**
 * Membersihkan sisa cookie auth yang berlingkup host-only.
 *
 * Sebelum `COOKIE_DOMAIN` diaktifkan, cookie sesi ditulis tanpa atribut
 * `Domain` sehingga terikat pada satu host saja (mis. `admin.radpro.id`).
 * Setelah `COOKIE_DOMAIN=.radpro.id` aktif, login baru menulis cookie
 * ber-`Domain`, dan browser menyimpan KEDUANYA dengan nama yang sama.
 *
 * Menurut RFC 6265 keduanya adalah entri berbeda: `Set-Cookie` berisi
 * `Domain=.radpro.id; Max-Age=0` yang dikirim NextAuth saat logout hanya
 * menghapus salah satunya. Cookie host-only yang tersisa tetap dikirim browser,
 * jadi sesi tidak pernah benar-benar berakhir.
 *
 * Terverifikasi di produksi: `POST /api/auth/signout` membalas 200 dengan
 * `set-cookie: __Secure-next-auth.session-token=; Max-Age=0; Domain=.radpro.id`,
 * tetapi `/api/auth/session` sesudahnya masih mengembalikan pengguna yang sama
 * di `admin.radpro.id` maupun `radpro.id`.
 */

/**
 * NextAuth memecah token besar menjadi `<nama>.0`, `<nama>.1`, dan seterusnya.
 * Jumlah pecahan pada cookie host-only lama tidak selalu sama dengan yang baru,
 * jadi penghapusan menyapu beberapa indeks sekaligus. Menghapus cookie yang
 * tidak ada tidak berefek apa pun.
 */
const MAX_SESSION_COOKIE_CHUNKS = 5;

/** Nama-nama cookie auth yang mungkin punya kembaran host-only. */
function listCleanableCookieNames(): string[] {
  const sessionName = authCookies.sessionToken.name;
  const chunkNames = Array.from(
    { length: MAX_SESSION_COOKIE_CHUNKS },
    (_, index) => `${sessionName}.${index}`,
  );

  // Cookie CSRF sengaja host-only (berawalan `__Host-`), jadi tidak disertakan.
  return [sessionName, ...chunkNames, authCookies.callbackUrl.name];
}

function readSetCookieHeaders(headers: Headers): string[] {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

function extractCookieName(setCookieHeader: string): string {
  return setCookieHeader.slice(0, setCookieHeader.indexOf("=")).trim();
}

/** Apakah respons ini menulis cookie auth yang berlingkup domain? */
function writesDomainScopedAuthCookie(setCookieHeaders: string[]): boolean {
  const cleanableNames = new Set(listCleanableCookieNames());

  return setCookieHeaders.some(
    (header) =>
      cleanableNames.has(extractCookieName(header)) &&
      /;\s*Domain=/i.test(header),
  );
}

function buildHostOnlyDeletion(name: string): string {
  const { httpOnly, sameSite, path, secure } = authCookies.sessionToken.options;
  const attributes = [
    `${name}=`,
    "Max-Age=0",
    `Path=${path}`,
    ...(httpOnly ? ["HttpOnly"] : []),
    ...(secure ? ["Secure"] : []),
    `SameSite=${sameSite.charAt(0).toUpperCase()}${sameSite.slice(1)}`,
  ];

  // Tanpa atribut `Domain` — persis inilah yang membuatnya menyasar cookie
  // host-only, bukan cookie berlingkup domain yang sudah ditangani NextAuth.
  return attributes.join("; ");
}

/**
 * Menambahkan penghapusan cookie host-only pada respons NextAuth yang menulis
 * cookie auth berlingkup domain (login maupun logout).
 */
export function withHostOnlyCookieCleanup(response: Response): Response {
  const cookieDomain = authCookies.sessionToken.options.domain;
  if (!cookieDomain) return response;

  const setCookieHeaders = readSetCookieHeaders(response.headers);
  if (!writesDomainScopedAuthCookie(setCookieHeaders)) return response;

  const patched = new Response(response.body, response);
  for (const name of listCleanableCookieNames()) {
    patched.headers.append("set-cookie", buildHostOnlyDeletion(name));
  }

  return patched;
}
