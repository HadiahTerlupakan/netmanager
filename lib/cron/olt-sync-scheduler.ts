/**
 * Scheduler untuk auto-sync data OLT dari SNMP ke database
 * Menggunakan node-cron untuk menjalankan sync secara berkala
 */

import cron from 'node-cron'
import { syncAllOltData } from '@/lib/services/olt-sync'

let syncJob: cron.ScheduledTask | null = null

/**
 * Start scheduler untuk auto-sync OLT data
 * Default: setiap 5 menit
 * @param cronExpression - Cron expression (default: setiap 5 menit)
 */
export function startOltSyncScheduler(cronExpression: string = '*/5 * * * *'): void {
  if (syncJob) {
    console.log('[OLT-Sync-Scheduler] Scheduler already running, stopping previous one...')
    stopOltSyncScheduler()
  }

  console.log(`[OLT-Sync-Scheduler] Starting OLT sync scheduler with cron: ${cronExpression}`)

  syncJob = cron.schedule(
    cronExpression,
    async () => {
      try {
        console.log(`[OLT-Sync-Scheduler] [${new Date().toISOString()}] Running scheduled OLT sync...`)
        const count = await syncAllOltData()
        console.log(`[OLT-Sync-Scheduler] [${new Date().toISOString()}] Scheduled sync completed. Synced ${count} OLTs`)
      } catch (error: any) {
        console.error(`[OLT-Sync-Scheduler] Error in scheduled sync:`, error?.message || error)
      }
    },
    {
      scheduled: true,
      timezone: 'Asia/Jakarta',
    }
  )

  console.log('[OLT-Sync-Scheduler] OLT sync scheduler started successfully')
}

/**
 * Stop scheduler
 */
export function stopOltSyncScheduler(): void {
  if (syncJob) {
    syncJob.stop()
    syncJob = null
    console.log('[OLT-Sync-Scheduler] OLT sync scheduler stopped')
  }
}

/**
 * Check if scheduler is running
 */
export function isOltSyncSchedulerRunning(): boolean {
  return syncJob !== null
}









