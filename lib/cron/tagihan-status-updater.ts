/**
 * Scheduler untuk auto-update status tagihan terlambat
 * Menggunakan node-cron untuk menjalankan update status secara berkala
 */

import cron from 'node-cron'
import { updateStatusTagihanTerlambat } from '@/lib/services/tagihan-service'

let updateJob: ReturnType<typeof cron.schedule> | null = null

/**
 * Start scheduler untuk auto-update status tagihan terlambat
 * Default: setiap hari jam 00:00
 * @param cronExpression - Cron expression (default: '0 0 * * *' = setiap hari jam 00:00)
 */
export function startTagihanStatusUpdater(cronExpression: string = '0 0 * * *'): void {
  if (updateJob) {
    console.log(
      '[Tagihan-Status-Updater] Scheduler already running, stopping previous one...',
    )
    stopTagihanStatusUpdater()
  }

  console.log(
    `[Tagihan-Status-Updater] Starting tagihan status updater scheduler with cron: ${cronExpression}`,
  )

  updateJob = cron.schedule(
    cronExpression,
    async () => {
      try {
        const now = new Date()
        console.log(
          `[Tagihan-Status-Updater] [${now.toISOString()}] Running scheduled status update...`,
        )

        const updated = await updateStatusTagihanTerlambat()

        console.log(
          `[Tagihan-Status-Updater] [${now.toISOString()}] Scheduled status update completed. Updated ${updated} tagihan(s)`,
        )
      } catch (error: any) {
        console.error(
          `[Tagihan-Status-Updater] Error in scheduled status update:`,
          error?.message || error,
        )
      }
    },
    {
      scheduled: true,
      timezone: 'Asia/Jakarta',
    } as any,
  )

  console.log(
    '[Tagihan-Status-Updater] Tagihan status updater scheduler started successfully',
  )
}

/**
 * Stop scheduler
 */
export function stopTagihanStatusUpdater(): void {
  if (updateJob) {
    updateJob.stop()
    updateJob = null
    console.log('[Tagihan-Status-Updater] Tagihan status updater scheduler stopped')
  }
}

/**
 * Check if scheduler is running
 */
export function isTagihanStatusUpdaterRunning(): boolean {
  return updateJob !== null
}







