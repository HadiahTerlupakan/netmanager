/**
 * Penentuan tujuan redirect setelah login/logout.
 *
 * Callback bawaan NextAuth hanya mengizinkan URL yang se-origin dengan
 * `NEXTAUTH_URL`. Di produksi `NEXTAUTH_URL` adalah apex `https://radpro.id`,
 * sedangkan portal dibuka dari subdomain, sehingga logout dari
 * `admin.radpro.id` dilempar ke apex — bukan ke halaman login portalnya.
 *
 * Daftar origin yang boleh dituju diambil dari `ALLOWED_ORIGINS` supaya tidak
 * menjadi open redirect: hanya host yang memang milik instalasi ini.
 */

export function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) return [];

  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function resolveAuthRedirect({
  url,
  baseUrl,
  allowedOrigins,
}: {
  url: string;
  baseUrl: string;
  allowedOrigins: string[];
}): string {
  if (url.startsWith("/")) return `${baseUrl}${url}`;

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return baseUrl;
  }

  if (target.origin === baseUrl) return url;
  if (allowedOrigins.includes(target.origin)) return url;

  return baseUrl;
}

export async function redirectCallback({
  url,
  baseUrl,
}: {
  url: string;
  baseUrl: string;
}): Promise<string> {
  return resolveAuthRedirect({
    url,
    baseUrl,
    allowedOrigins: parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
  });
}
