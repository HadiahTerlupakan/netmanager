import { redis } from '@/lib/redis'

/**
 * Acquires a distributed Redis lock for the given cron job name.
 * Returns true if lock acquired (this pod should run the job).
 * Returns false if another pod holds the lock (skip).
 * Lock auto-expires after ttlSeconds to prevent deadlock.
 *
 * Usage:
 *   cron.schedule('* * * * *', async () => {
 *     if (!await acquireCronLock('myJobName', 55)) return
 *     await doWork()
 *   })
 */
export async function acquireCronLock(jobName: string, ttlSeconds: number = 55): Promise<boolean> {
  const lockKey = `cron:lock:${jobName}`
  try {
    // ioredis: set(key, value, expiryMode, time, setMode)
    const result = await redis.set(lockKey, '1', 'EX', ttlSeconds, 'NX')
    return result === 'OK'
  } catch (err: unknown) {
    // If Redis is unavailable, fail open so the job still runs (single-pod safety net)
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[CronLock] Redis error acquiring lock for "${jobName}": ${message}`)
    return true
  }
}
