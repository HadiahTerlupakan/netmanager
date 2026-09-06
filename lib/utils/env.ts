/**
 * Environment variable utilities dengan runtime validation.
 * Gunakan helpers ini untuk akses env vars yang critical.
 */

export class EnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvironmentError";
  }
}

/**
 * Get application URL dengan validation.
 * Throws EnvironmentError jika tidak terset.
 */
export function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;

  if (!url || url === "undefined") {
    throw new EnvironmentError(
      "NEXT_PUBLIC_APP_URL is not configured. " +
        "Set this environment variable in your deployment configuration.",
    );
  }

  // Validate format URL
  try {
    new URL(url);
  } catch {
    throw new EnvironmentError(
      `NEXT_PUBLIC_APP_URL has invalid URL format: ${url}`,
    );
  }

  return url;
}

/**
 * URL situs publik (apex), tempat landing page berada.
 *
 * Subdomain portal tidak punya landing page: `proxy.ts` menulis ulang setiap
 * path di `admin.<domain>` ke `/admin/*` dan mengalihkan tamu ke `/login`,
 * sehingga tanpa tautan absolut ke apex pengguna yang sudah logout terkurung
 * di halaman login. Berbeda dari `getAppUrl()`, helper ini tidak melempar
 * error karena hanya dipakai untuk menampilkan tautan.
 */
export function getPublicSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;

  if (!url || url === "undefined") return "/";

  return url.replace(/\/$/, "");
}

/**
 * Get required environment variable dengan validation.
 */
export function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value || value === "undefined") {
    throw new EnvironmentError(
      `${name} is not configured. Set this environment variable.`,
    );
  }

  return value;
}

/**
 * Check all critical environment variables at startup.
 * Call this in server.ts or app initialization.
 */
export function validateCriticalEnvVars(): void {
  const criticalVars = [
    "NEXT_PUBLIC_APP_URL",
    "DATABASE_URL",
    "REDIS_URL",
    "AUTH_SECRET",
    "NEXTAUTH_SECRET",
  ];

  const missing: string[] = [];

  for (const varName of criticalVars) {
    const value = process.env[varName];
    if (!value || value === "undefined") {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    throw new EnvironmentError(
      `Missing required environment variables:\n  - ${missing.join("\n  - ")}\n\n` +
        "Please configure these in your deployment environment.",
    );
  }
}
