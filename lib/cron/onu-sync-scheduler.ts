/**
 * Scheduler untuk auto-sync data ONU dari SNMP ke database
 * Menggunakan node-cron untuk menjalankan sync secara berkala
 */

import cron from 'node-cron'
import { syncAllOnuData } from '@/lib/services/onu-sync'

let syncJob: cron.ScheduledTask | null = null

/**
 * Start scheduler untuk auto-sync ONU data
 * Default: setiap 5 menit
 * @param cronExpression - Cron expression (default: setiap 5 menit)
 */
export function startOnuSyncScheduler(cronExpression: string = '*/5 * * * *'): void {
  if (syncJob) {
    console.log('[ONU-Sync-Scheduler] Scheduler already running, stopping previous one...')
    stopOnuSyncScheduler()
  }

  console.log(`[ONU-Sync-Scheduler] Starting ONU sync scheduler with cron: ${cronExpression}`)

  syncJob = cron.schedule(
    cronExpression,
    async () => {
      try {
        console.log(`[ONU-Sync-Scheduler] [${new Date().toISOString()}] Running scheduled ONU sync...`)
        const count = await syncAllOnuData()
        console.log(`[ONU-Sync-Scheduler] [${new Date().toISOString()}] Scheduled sync completed. Synced ${count} ONUs`)
      } catch (error: any) {
        console.error(`[ONU-Sync-Scheduler] Error in scheduled sync:`, error?.message || error)
      }
    },
    {
      scheduled: true,
      timezone: 'Asia/Jakarta', // Sesuaikan dengan timezone yang digunakan
    }
  )

  console.log('[ONU-Sync-Scheduler] ONU sync scheduler started successfully')
}

/**
 * Stop scheduler
 */
export function stopOnuSyncScheduler(): void {
  if (syncJob) {
    syncJob.stop()
    syncJob = null
    console.log('[ONU-Sync-Scheduler] ONU sync scheduler stopped')
  }
}

/**
 * Check if scheduler is running
 */
export function isOnuSyncSchedulerRunning(): boolean {
  return syncJob !== null
}

