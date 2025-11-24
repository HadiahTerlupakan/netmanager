/**
 * Scheduler untuk auto-sync data ONU dari SNMP ke database
 * Menggunakan node-cron untuk menjalankan sync secara berkala
 * 
 * OPTIMIZED VERSION:
 * - Uses bulk sync service (Phase 3) for faster SNMP operations
 * - Uses incremental sync (Phase 4) for reduced DB operations
 * - Automatically invalidates Redis cache (Phase 1)
 */

import cron from 'node-cron'
import { getOLTRepository, getOnuRepository } from '@/lib/repositories'
import { syncOnuDataByOltId } from '@/lib/services/onu-sync'
import { onuIncrementalSyncService } from '@/lib/services/onu-sync-incremental'
import { getC300GponOnuDataViaSNMP } from '@/app/api/onus/sync/route'
import { logger } from '@/lib/logger'

let syncJob: ReturnType<typeof cron.schedule> | null = null
let useOptimizedSync = true // Toggle to enable/disable optimizations

/**
 * Set whether to use optimized sync (for testing/rollback)
 */
export function setOptimizedSyncMode(enabled: boolean): void {
  useOptimizedSync = enabled
  logger.info(`Optimized sync mode ${enabled ? 'enabled' : 'disabled'}`)
}

/**
 * Start scheduler untuk auto-sync ONU data
 * Default: setiap 5 menit
 * @param cronExpression - Cron expression (default: setiap 5 menit)
 */
export function startOnuSyncScheduler(cronExpression: string = '*/5 * * * *'): void {
  if (syncJob) {
    logger.info('Scheduler already running, stopping previous one...')
    stopOnuSyncScheduler()
  }

  logger.info(`Starting ONU sync scheduler with cron: ${cronExpression}`)
  logger.info(`Mode: ${useOptimizedSync ? 'OPTIMIZED (Phase 3+4)' : 'LEGACY'}`)

  syncJob = cron.schedule(
    cronExpression,
    async () => {
      const startTime = Date.now()

      try {
        logger.info(`[${new Date().toISOString()}] Running scheduled ONU sync...`)

        const oltRepo = getOLTRepository()
        const olts = await oltRepo.findAll()
        const connectedOlts = olts.filter(
          (olt) =>
            olt.snmpConnected &&
            olt.snmpCommunityWrite &&
            olt.type?.toLowerCase().includes('c300') &&
            olt.onuSyncEnabled !== false
        )

        if (connectedOlts.length === 0) {
          logger.info('No C300 OLTs with SNMP connected and sync enabled')
          return
        }

        logger.info(`Found ${connectedOlts.length} OLTs to sync`)

        let totalSynced = 0
        let totalSkipped = 0

        for (const olt of connectedOlts) {
          try {
            if (useOptimizedSync) {
              // OPTIMIZED PATH: Incremental sync with delta detection
              logger.info(`Syncing OLT ${olt.name} using OPTIMIZED mode (incremental)`)

              // 1. Fetch ONU data from SNMP
              const onuData = await getC300GponOnuDataViaSNMP(
                olt.ipAddress,
                olt.snmpPort,
                olt.snmpCommunityWrite,
                olt.snmpVersion,
                olt.id
              )

              if (onuData.length === 0) {
                logger.info(`No ONU data found for OLT ${olt.name}`)
                continue
              }

              // 2. Use incremental sync (only update changed ONUs)
              const result = await onuIncrementalSyncService.syncIncremental(
                olt.id,
                onuData,
                {
                  deleteRemovedOnus: false, // Safety: don't auto-delete in scheduled sync
                  maxDeletePercent: 5, // Max 5% deletions for scheduled sync
                }
              )

              const efficiency = onuIncrementalSyncService.calculateEfficiency(result.delta)
              totalSynced += result.delta.new + result.delta.updated
              totalSkipped += result.delta.unchanged

              // 3. Update OLT timestamp
              await oltRepo.update(olt.id, {
                onuLastSync: new Date(),
              })

              logger.info(
                `Synced OLT ${olt.name}: ` +
                `${result.delta.new} new, ${result.delta.updated} updated, ` +
                `${result.delta.unchanged} unchanged (${efficiency.efficiencyPercent}% efficiency)`
              )
            } else {
              // LEGACY PATH: Full sync (fallback)
              logger.info(`Syncing OLT ${olt.name} using LEGACY mode (full sync)`)
              const count = await syncOnuDataByOltId(olt.id)
              totalSynced += count
              logger.info(`Synced ${count} ONUs for OLT ${olt.name}`)
            }
          } catch (error: any) {
            logger.error(
              `Error syncing OLT ${olt.name}`,
              error instanceof Error ? error : new Error(String(error))
            )
          }
        }

        const duration = Date.now() - startTime
        logger.info(
          `[${new Date().toISOString()}] Scheduled sync completed. ` +
          `${totalSynced} ONUs synced, ${totalSkipped} skipped, ` +
          `${connectedOlts.length} OLTs processed in ${(duration / 1000).toFixed(2)}s`
        )
      } catch (error: any) {
        logger.error(
          'Error in scheduled sync',
          error instanceof Error ? error : new Error(String(error))
        )
      }
    },
    {
      scheduled: true,
      timezone: 'Asia/Jakarta',
    } as any
  )

  logger.info('ONU sync scheduler started successfully')
}

/**
 * Stop scheduler
 */
export function stopOnuSyncScheduler(): void {
  if (syncJob) {
    syncJob.stop()
    syncJob = null
    logger.info('ONU sync scheduler stopped')
  }
}

/**
 * Check if scheduler is running
 */
export function isOnuSyncSchedulerRunning(): boolean {
  return syncJob !== null
}

/**
 * Get current sync mode
 */
export function getOptimizedSyncMode(): boolean {
  return useOptimizedSync
}
