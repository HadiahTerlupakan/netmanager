import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";

const REVOKED_SESSION_KEY_PREFIX = "pelanggan:sesi-dicabut:";

function buildRevokedSessionKey(sessionId: string) {
  return `${REVOKED_SESSION_KEY_PREFIX}${sessionId}`;
}

/**
 * Catat satu sesi login pelanggan (satu perangkat) sebagai sudah logout.
 * Kunci cukup hidup selama umur refresh token: setelah itu token sesi
 * tersebut kedaluwarsa sendiri. Melempar bila Redis gagal, supaya pemanggil
 * bisa memilih mencabut semua sesi daripada membiarkan sesi ini hidup.
 */
export async function markPelangganSessionRevoked(
  sessionId: string,
  ttlSeconds: number,
): Promise<void> {
  await redis.setex(buildRevokedSessionKey(sessionId), ttlSeconds, "1");
}

/**
 * Apakah sesi ini sudah logout. Bila Redis tidak terbaca, sesi dianggap
 * masih hidup: menolak refresh berarti mengeluarkan SEMUA pelanggan selama
 * Redis bermasalah, sementara yang dipertaruhkan hanya perangkat yang sudah
 * logout dan token-nya kebetulan bocor. Ganti password tetap mencabut lewat
 * `tokenVersion` di basis data, yang tidak bergantung pada Redis.
 */
export async function isPelangganSessionRevoked(
  sessionId: string,
): Promise<boolean> {
  try {
    return (await redis.exists(buildRevokedSessionKey(sessionId))) > 0;
  } catch (error) {
    logger.warn(
      "[PelangganSession] Daftar sesi logout tidak terbaca; refresh tetap diizinkan",
      error,
    );
    return false;
  }
}
