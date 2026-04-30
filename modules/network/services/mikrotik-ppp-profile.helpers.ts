import { logger } from "@/lib/logger";
import type { RouterOSAPI } from "node-routeros-v2";

export type MikroTikCommandResult = { success: boolean; error?: string };

/** Tutup koneksi MikroTik secara aman. */
export function closeRouterConnection(conn: RouterOSAPI): void {
  conn.close();
}

/** Validasi hasil trap dari command RouterOS. */
export function getTrapError(result: unknown): string | null {
  if (!Array.isArray(result) || result.length === 0) {
    return null;
  }

  const firstResult = result[0] as Record<string, unknown> | undefined;
  if (!firstResult || !firstResult["!trap"]) {
    return null;
  }

  return String(firstResult.message || "Terjadi kesalahan");
}

/** Tunda singkat untuk memberi waktu commit konfigurasi MikroTik. */
export async function waitForRouterCommit(delayMs: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

/** Verifikasi profile PPP sudah tersedia. */
export async function findProfileByName(
  conn: RouterOSAPI,
  profileName: string,
) {
  const profiles = await conn.write("/ppp/profile/print", [
    `?name=${profileName}`,
  ]);
  return Array.isArray(profiles) ? profiles[0] : null;
}

/** Catat warning mismatch rate limit setelah sinkronisasi. */
export function warnOnRateLimitMismatch(params: {
  actualRateLimit: string | null;
  expectedRateLimit: string;
  context: string;
}): void {
  const { actualRateLimit, expectedRateLimit, context } = params;

  if (!actualRateLimit || actualRateLimit.trim() === "") {
    logger.warn(
      `[MikroTik PPP] WARNING: rate-limit tidak ter-set di MikroTik${context}!`,
    );
    return;
  }

  if (actualRateLimit !== expectedRateLimit) {
    logger.warn(`[MikroTik PPP] WARNING: rate-limit tidak sesuai${context}!`);
  }
}
