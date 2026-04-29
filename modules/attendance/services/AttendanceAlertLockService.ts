import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";

/** Ambil lock Redis agar reminder tidak terkirim berulang. */
export async function acquireReminderLock(
  key: string,
  ttlSeconds: number,
): Promise<boolean> {
  try {
    const result = await redis.set(key, "1", "EX", ttlSeconds, "NX");
    return result === "OK";
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(
      `[AttendanceAlert] Reminder lock unavailable for "${key}": ${message}`,
    );
    return false;
  }
}
