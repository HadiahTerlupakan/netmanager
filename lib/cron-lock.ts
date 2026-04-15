import { redis } from "@/lib/redis";

export const CRON_LOCK_UNAVAILABLE_MESSAGE =
  "Layanan cron sementara tidak tersedia. Coba lagi beberapa saat.";

export type CronLockResult = "acquired" | "locked" | "unavailable";

/**
 * Acquires a distributed Redis lock for the given cron job name.
 * Returns acquired if lock granted, locked if held elsewhere,
 * and unavailable if Redis lock storage cannot be reached.
 * Lock auto-expires after ttlSeconds to prevent deadlock.
 *
 * Usage:
 *   cron.schedule('* * * * *', async () => {
 *     const lockResult = await acquireCronLock('myJobName', 55)
 *     if (lockResult !== 'acquired') return
 *     await doWork()
 *   })
 */
export async function acquireCronLock(
  jobName: string,
  ttlSeconds: number = 55,
): Promise<CronLockResult> {
  const lockKey = `cron:lock:${jobName}`;

  try {
    const result = await redis.set(lockKey, "1", "EX", ttlSeconds, "NX");
    return result === "OK" ? "acquired" : "locked";
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[CronLock] Redis error acquiring lock for "${jobName}": ${message}`,
    );
    return "unavailable";
  }
}
