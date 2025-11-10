/**
 * Scheduler untuk auto-check API connection status MikroTik Router
 * Menggunakan node-cron untuk menjalankan check secara berkala
 */

import cron from 'node-cron'
import { checkAllMikroTikRouterStatus } from '@/lib/services/mikrotik-ping-check'

let statusCheckJob: cron.ScheduledTask | null = null

/**
 * Start scheduler untuk auto-check API connection status
 * Default: setiap 5 menit
 * @param cronExpression - Cron expression (default: setiap 5 menit)
 */
export function startMikroTikPingScheduler(cronExpression: string = '*/5 * * * *'): void {
  if (statusCheckJob) {
    console.log('[MikroTik-Status-Scheduler] Scheduler already running, stopping previous one...')
    stopMikroTikPingScheduler()
  }

  console.log(`[MikroTik-Status-Scheduler] Starting MikroTik API connection check scheduler with cron: ${cronExpression}`)

  statusCheckJob = cron.schedule(
    cronExpression,
    async () => {
      try {
        console.log(`[MikroTik-Status-Scheduler] [${new Date().toISOString()}] Running scheduled API connection check...`)
        const count = await checkAllMikroTikRouterStatus()
        console.log(`[MikroTik-Status-Scheduler] [${new Date().toISOString()}] Scheduled API connection check completed. Updated ${count} routers`)
      } catch (error: any) {
        console.error(`[MikroTik-Status-Scheduler] Error in scheduled API connection check:`, error?.message || error)
      }
    },
    {
      scheduled: true,
      timezone: 'Asia/Jakarta',
    }
  )

  console.log('[MikroTik-Status-Scheduler] MikroTik API connection check scheduler started successfully')
}

/**
 * Stop scheduler
 */
export function stopMikroTikPingScheduler(): void {
  if (statusCheckJob) {
    statusCheckJob.stop()
    statusCheckJob = null
    console.log('[MikroTik-Status-Scheduler] Scheduler stopped')
  }
}

