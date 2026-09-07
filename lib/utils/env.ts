/**
 * Environment variable utilities dengan runtime validation.
 * Gunakan helpers ini untuk akses env vars yang critical.
 */

import { logger } from "@/lib/logger";
import { isUsingLegacyEncryptionKey } from "./encryption";

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
export function warnOnInsecureEncryptionKey(): void {
  if (!isUsingLegacyEncryptionKey()) return;

  const message =
    "ENCRYPTION_KEY belum diset — kredensial di database dienkripsi dengan kunci cadangan yang nilainya ada di repo. " +
    "Isi ENCRYPTION_KEY lalu jalankan scripts/reencrypt-secrets.ts.";

  if (process.env.NODE_ENV === "production") {
    logger.error(message);
    return;
  }

  logger.warn(message);
}

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

  warnOnInsecureEncryptionKey();

  if (missing.length > 0) {
    throw new EnvironmentError(
      `Missing required environment variables:\n  - ${missing.join("\n  - ")}\n\n` +
        "Please configure these in your deployment environment.",
    );
  }
}
