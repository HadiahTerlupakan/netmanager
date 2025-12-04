/**
 * Utility untuk mengambil timezone dari database settings
 * Digunakan oleh cron jobs untuk mendapatkan timezone yang dikonfigurasi
 */

import { prisma } from '@/lib/prisma'
import { DEFAULT_TIMEZONE } from '@/lib/constants/timezone-constants'

// Cache untuk menghindari query berlebihan
let cachedTimezone: string | null = null
let cacheTimestamp: number = 0
const CACHE_TTL_MS = 60 * 1000 // 1 menit cache

/**
 * Ambil timezone dari database settings
 * Dengan caching untuk performa
 */
export async function getTimezone(): Promise<string> {
    const now = Date.now()

    // Gunakan cache jika masih valid
    if (cachedTimezone && (now - cacheTimestamp) < CACHE_TTL_MS) {
        return cachedTimezone
    }

    try {
        const setting = await prisma.settings.findUnique({
            where: { key: 'GENERAL_TIMEZONE' },
            select: { value: true },
        })

        cachedTimezone = setting?.value || DEFAULT_TIMEZONE
        cacheTimestamp = now

        return cachedTimezone
    } catch (error) {
        console.error('[getTimezone] Error fetching timezone:', error)
        // Fallback ke default jika error
        return cachedTimezone || DEFAULT_TIMEZONE
    }
}

/**
 * Invalidate timezone cache
 * Dipanggil saat timezone diubah di settings
 */
export function invalidateTimezoneCache(): void {
    cachedTimezone = null
    cacheTimestamp = 0
}
