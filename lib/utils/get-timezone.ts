import { logger } from "@/lib/logger";
/**
 * Utility untuk mengambil timezone dari database settings
 * Digunakan oleh cron jobs untuk mendapatkan timezone yang dikonfigurasi
 */

import { prisma } from "@/lib/prisma";
import { DEFAULT_TIMEZONE } from "@/lib/constants/timezone-constants";

// Cache untuk menghindari query berlebihan, dipisahkan per tenant
// Key: tenantId, Value: { timezone: string, timestamp: number }
const timezoneCache = new Map<
  string,
  { timezone: string; timestamp: number }
>();
const CACHE_TTL_MS = 60 * 1000; // 1 menit cache

/**
 * Ambil timezone dari database settings berdasarkan tenantId
 * Dengan caching per-tenant untuk performa dan isolasi
 * @param tenantId - ID Tenant yang ingin diambil timezone-nya
 */
export async function getTimezone(tenantId?: string): Promise<string> {
  const now = Date.now();

  // Gunakan "GLOBAL" sebagai key jika tenantId tidak ada (fallback)
  const key = tenantId || "GLOBAL";

  // Gunakan cache jika masih valid
  const cached = timezoneCache.get(key);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.timezone;
  }

  try {
    const setting = await prisma.settings.findFirst({
      where: {
        key: "GENERAL_TIMEZONE",
        ...(tenantId && { tenantId }), // Filter by tenant if provided
      },
      select: { value: true },
    });

    const timezone = setting?.value || DEFAULT_TIMEZONE;

    // Simpan ke cache
    timezoneCache.set(key, { timezone, timestamp: now });

    return timezone;
  } catch (error) {
    logger.error(
      `[getTimezone] Error fetching timezone for tenant ${key}:`,
      error,
    );
    // Fallback ke default jika error
    return cached?.timezone || DEFAULT_TIMEZONE;
  }
}

/**
 * Ambil timezone dari cache secara sinkron
 * Berguna untuk fungsi utilitas yang tidak bisa async
 * @param tenantId - ID Tenant
 * @returns Timezone string atau default
 */
export function getTimezoneSync(tenantId?: string): string {
  const key = tenantId || "GLOBAL";
  const cached = timezoneCache.get(key);
  return cached?.timezone || DEFAULT_TIMEZONE;
}

/**
 * Invalidate timezone cache
 * Dipanggil saat timezone diubah di settings
 * @param tenantId - Optional ID Tenant yang ingin di-invalidate
 */
export function invalidateTimezoneCache(tenantId?: string): void {
  if (tenantId) {
    timezoneCache.delete(tenantId);
  } else {
    timezoneCache.clear();
  }
}
