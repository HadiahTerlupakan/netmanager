/**
 * Scheduler untuk auto-sync data ONU dari SNMP ke database
 * Menggunakan node-cron untuk menjalankan sync secara berkala
 * 
 * CATATAN: Scheduler ini menggunakan service yang sama dengan sync manual dari menu OLT
 * Data disimpan ke database yang sama, sehingga tidak ada duplikasi
 */

import cron from 'node-cron'
import { getOLTRepository } from '@/lib/repositories'
import { syncOnuDataByOltId } from '@/lib/services/onu-sync'

let syncJob: ReturnType<typeof cron.schedule> | null = null

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
  console.log(`[ONU-Sync-Scheduler] Using same service as manual sync from OLT menu (syncOnuDataByOltId)`)

  syncJob = cron.schedule(
    cronExpression,
    async () => {
      try {
        console.log(`[ONU-Sync-Scheduler] [${new Date().toISOString()}] Running scheduled ONU sync...`)
        
        const oltRepo = getOLTRepository()
        const olts = await oltRepo.findAll()
        const connectedOlts = olts.filter(
          (olt) =>
            olt.snmpConnected &&
            olt.snmpCommunityWrite &&
            olt.type?.toLowerCase().includes('c300') &&
            olt.onuSyncEnabled !== false // Default true, hanya skip jika explicitly false
        )

        if (connectedOlts.length === 0) {
          console.log(`[ONU-Sync-Scheduler] No C300 OLTs with SNMP connected and sync enabled`)
          return
        }

        console.log(`[ONU-Sync-Scheduler] Found ${connectedOlts.length} OLTs to sync`)
        
        let totalSynced = 0
        for (const olt of connectedOlts) {
          try {
            // Gunakan service yang sama dengan sync manual dari menu OLT
            // Tidak ada progress callback karena ini background job
            const count = await syncOnuDataByOltId(olt.id)
            totalSynced += count
            console.log(`[ONU-Sync-Scheduler] Synced ${count} ONUs for OLT ${olt.name}`)
          } catch (error: any) {
            console.error(`[ONU-Sync-Scheduler] Error syncing OLT ${olt.name}:`, error?.message || error)
          }
        }
        
        console.log(`[ONU-Sync-Scheduler] [${new Date().toISOString()}] Scheduled sync completed. Synced ${totalSynced} ONUs from ${connectedOlts.length} OLTs`)
      } catch (error: any) {
        console.error(`[ONU-Sync-Scheduler] Error in scheduled sync:`, error?.message || error)
      }
    },
    {
      scheduled: true,
      timezone: 'Asia/Jakarta',
    } as any
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

