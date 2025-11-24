/**
 * Optimized Bulk ONU Sync Service - Phase 3
 * 
 * Performance optimizations:
 * 1. SNMP WALK for bulk index retrieval (faster than individual GETs)
 * 2. Concurrent batch processing (5 batches in parallel)
 * 3. Smart rate limiting to protect OLT
 * 4. Progress tracking for UI updates
 * 5. Automatic cache invalidation
 * 
 * Target: Sync 1000 ONUs in 3-5 minutes (vs 20-30 minutes before)
 */

import { getOLTRepository, getOnuRepository } from '@/lib/repositories'
import { logger } from '@/lib/logger'
import snmp from 'net-snmp'

interface SyncProgress {
    phase: 'counting' | 'fetching' | 'saving' | 'complete'
    percentage: number
    current: number
    total: number
    message: string
}

interface BulkSyncResult {
    success: boolean
    synced: number
    errors: number
    duration: number
}

/**
 * Optimized bulk sync service
 */
export class OnuBulkSyncService {
    private static readonly BATCH_SIZE = 50 // Process 50 ONUs per batch
    private static readonly MAX_CONCURRENT_BATCHES = 5 // Max 5 batches in parallel
    private static readonly RATE_LIMIT_DELAY = 100 // 100ms between batches
    private static readonly SNMP_TIMEOUT = 10000 // 10 second timeout
    private static readonly SNMP_RETRIES = 3 // Retry 3 times on failure

    /**
     * Sync ONUs for a specific OLT with progress tracking
     */
    async syncOltOnus(
        oltId: string,
        onProgress?: (progress: SyncProgress) => void
    ): Promise<BulkSyncResult> {
        const startTime = Date.now()

        try {
            const oltRepo = getOLTRepository()
            const onuRepo = getOnuRepository()

            // Get OLT info
            const olt = await oltRepo.findById(oltId)
            if (!olt) {
                throw new Error(`OLT with ID ${oltId} not found`)
            }

            if (!olt.snmpConnected || !olt.snmpCommunityWrite) {
                throw new Error(`OLT ${olt.name} is not connected via SNMP`)
            }

            logger.info(`Starting optimized bulk sync for OLT ${olt.name}`, {
                oltId,
                ipAddress: olt.ipAddress,
            })

            // Phase 1: Count ONUs (fast)
            this.reportProgress(onProgress, {
                phase: 'counting',
                percentage: 5,
                current: 0,
                total: 0,
                message: 'Counting ONUs...',
            })

            const onuIndexes = await this.walkOnuIndexes(olt)
            const totalOnus = onuIndexes.length

            logger.info(`Found ${totalOnus} ONUs on OLT ${olt.name}`)

            if (totalOnus === 0) {
                return {
                    success: true,
                    synced: 0,
                    errors: 0,
                    duration: Date.now() - startTime,
                }
            }

            // Phase 2: Fetch ONU data in parallel batches
            this.reportProgress(onProgress, {
                phase: 'fetching',
                percentage: 10,
                current: 0,
                total: totalOnus,
                message: `Fetching ${totalOnus} ONUs...`,
            })

            const onus = await this.fetchOnusInParallel(
                olt,
                onuIndexes,
                (fetched) => {
                    const fetchProgress = 10 + Math.floor((fetched / totalOnus) * 40) // 10-50%
                    this.reportProgress(onProgress, {
                        phase: 'fetching',
                        percentage: fetchProgress,
                        current: fetched,
                        total: totalOnus,
                        message: `Fetched ${fetched}/${totalOnus} ONUs`,
                    })
                }
            )

            logger.info(`Fetched ${onus.length} ONUs from OLT ${olt.name}`)

            // Phase 3: Save to database in batches
            this.reportProgress(onProgress, {
                phase: 'saving',
                percentage: 50,
                current: 0,
                total: onus.length,
                message: 'Saving ONUs to database...',
            })

            let saved = 0
            let errors = 0

            const batches = this.chunkArray(onus, OnuBulkSyncService.BATCH_SIZE)

            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i]

                // Save batch
                const results = await Promise.allSettled(
                    batch.map(onu =>
                        onuRepo.upsert(oltId, onu.gponOnu, {
                            oltId,
                            name: onu.name || '',
                            description: onu.description,
                            gponOnu: onu.gponOnu,
                            status: onu.status || 'Unknown',
                            rxOlt: onu.rxOlt,
                            rxOnu: onu.rxOnu,
                            serialNumber: onu.serialNumber,
                            actualType: onu.actualType,
                            lastSeen: new Date(),
                        })
                    )
                )

                // Count successes
                results.forEach(r => {
                    if (r.status === 'fulfilled') saved++
                    else errors++
                })

                // Report progress
                const saveProgress = 50 + Math.floor(((i + 1) / batches.length) * 45) // 50-95%
                this.reportProgress(onProgress, {
                    phase: 'saving',
                    percentage: saveProgress,
                    current: saved,
                    total: onus.length,
                    message: `Saved ${saved}/${onus.length} ONUs`,
                })

                // Rate limiting between batches
                if (i < batches.length - 1) {
                    await this.sleep(OnuBulkSyncService.RATE_LIMIT_DELAY)
                }
            }

            // Update OLT sync timestamp
            await oltRepo.update(oltId, {
                onuLastSync: new Date(),
            })

            // Invalidate cache
            await onuRepo.invalidateCache(oltId)

            // Complete
            this.reportProgress(onProgress, {
                phase: 'complete',
                percentage: 100,
                current: saved,
                total: saved,
                message: `Sync complete! Saved ${saved} ONUs`,
            })

            const duration = Date.now() - startTime
            logger.info(`Bulk sync completed for OLT ${olt.name}`, {
                synced: saved,
                errors,
                duration: `${(duration / 1000).toFixed(2)}s`,
            })

            return {
                success: true,
                synced: saved,
                errors,
                duration,
            }
        } catch (error) {
            logger.error('Bulk sync failed', error instanceof Error ? error : new Error(String(error)), { oltId })
            throw error
        }
    }

    /**
     * Walk ONU table to get all indexes (much faster than individual GETs)
     */
    private async walkOnuIndexes(olt: any): Promise<number[]> {
        return new Promise((resolve, reject) => {
            const session = snmp.createSession(
                olt.ipAddress,
                olt.snmpCommunityWrite || 'public',
                {
                    port: olt.snmpPort || 161,
                    retries: OnuBulkSyncService.SNMP_RETRIES,
                    timeout: OnuBulkSyncService.SNMP_TIMEOUT,
                    version: olt.snmpVersion === '1' ? snmp.Version1 : snmp.Version2c,
                }
            )

            const baseOid = '1.3.6.1.4.1.3902.1012.3.28.1.1.1' // ONU index table
            const indexes: number[] = []

            session.walk(
                baseOid,
                20, // maxRepetitions
                (varbinds) => {
                    varbinds.forEach(vb => {
                        if (snmp.isVarbindError(vb)) return

                        // Extract composite index from OID
                        const oidParts = vb.oid.split('.')
                        const compositeIndex = parseInt(oidParts[oidParts.length - 1], 10)

                        if (!isNaN(compositeIndex) && compositeIndex > 0) {
                            indexes.push(compositeIndex)
                        }
                    })
                },
                (error) => {
                    session.close()
                    if (error) {
                        logger.error('SNMP walk failed', error instanceof Error ? error : new Error(String(error)))
                        reject(error)
                    } else {
                        // Remove duplicates and sort
                        const uniqueIndexes = Array.from(new Set(indexes)).sort((a, b) => a - b)
                        resolve(uniqueIndexes)
                    }
                }
            )
        })
    }

    /**
     * Fetch ONUs in parallel batches for maximum speed
     */
    private async fetchOnusInParallel(
        olt: any,
        indexes: number[],
        onProgress?: (fetched: number) => void
    ): Promise<any[]> {
        const batches = this.chunkArray(indexes, OnuBulkSyncService.BATCH_SIZE)
        const allOnus: any[] = []
        let fetchedCount = 0

        // Process batches with concurrency limit
        for (let i = 0; i < batches.length; i += OnuBulkSyncService.MAX_CONCURRENT_BATCHES) {
            const concurrentBatches = batches.slice(i, i + OnuBulkSyncService.MAX_CONCURRENT_BATCHES)

            const results = await Promise.allSettled(
                concurrentBatches.map(batch => this.fetchOnuBatch(olt, batch))
            )

            results.forEach(result => {
                if (result.status === 'fulfilled') {
                    allOnus.push(...result.value)
                    fetchedCount += result.value.length
                    onProgress?.(fetchedCount)
                }
            })

            // Rate limit between concurrent batch groups
            if (i + OnuBulkSyncService.MAX_CONCURRENT_BATCHES < batches.length) {
                await this.sleep(OnuBulkSyncService.RATE_LIMIT_DELAY)
            }
        }

        return allOnus
    }

    /**
     * Fetch a batch of ONUs using SNMP GET
     */
    private async fetchOnuBatch(olt: any, indexes: number[]): Promise<any[]> {
        return new Promise((resolve, reject) => {
            const session = snmp.createSession(
                olt.ipAddress,
                olt.snmpCommunityWrite || 'public',
                {
                    port: olt.snmpPort || 161,
                    retries: OnuBulkSyncService.SNMP_RETRIES,
                    timeout: OnuBulkSyncService.SNMP_TIMEOUT,
                    version: olt.snmpVersion === '1' ? snmp.Version1 : snmp.Version2c,
                }
            )

            // Build OIDs for bulk GET
            const oids = indexes.flatMap(idx => [
                `1.3.6.1.4.1.3902.1012.3.28.1.1.3.${idx}`, // Name
                `1.3.6.1.4.1.3902.1012.3.28.2.1.4.${idx}`, // Status
                `1.3.6.1.4.1.3902.1012.3.28.2.1.7.${idx}`, // RX OLT
                `1.3.6.1.4.1.3902.1012.3.28.2.1.8.${idx}`, // RX ONU
                `1.3.6.1.4.1.3902.1012.3.50.12.1.1.10.${idx}`, // Serial Number
            ])

            session.get(oids, (error, varbinds) => {
                session.close()

                if (error) {
                    reject(error)
                    return
                }

                if (!varbinds) {
                    resolve([])
                    return
                }

                const onus: any[] = []

                // Parse results (every 5 OIDs = 1 ONU)
                for (let i = 0; i < indexes.length; i++) {
                    const baseIdx = i * 5
                    const compositeIndex = indexes[i]

                    // Decode gponOnu from composite index
                    const frame = Math.floor(compositeIndex / 16777216)
                    const slot = Math.floor((compositeIndex % 16777216) / 65536)
                    const port = Math.floor((compositeIndex % 65536) / 256)
                    const onuId = compositeIndex % 256

                    const onu = {
                        gponOnu: `${frame}/${slot}/${port}:${onuId}`,
                        name: this.parseValue(varbinds[baseIdx]),
                        status: this.parseStatus(varbinds[baseIdx + 1]),
                        rxOlt: this.parseValue(varbinds[baseIdx + 2]),
                        rxOnu: this.parseValue(varbinds[baseIdx + 3]),
                        serialNumber: this.parseValue(varbinds[baseIdx + 4]),
                        actualType: null,
                        description: null,
                        pppoe: null,
                    }

                    onus.push(onu)
                }

                resolve(onus)
            })
        })
    }

    /**
     * Parse SNMP value
     */
    private parseValue(varbind: any): string | null {
        if (!varbind || snmp.isVarbindError(varbind)) return null

        if (Buffer.isBuffer(varbind.value)) {
            return varbind.value.toString('utf8').replace(/\0/g, '').trim()
        }

        return String(varbind.value || '').trim() || null
    }

    /**
     * Parse ONU status
     */
    private parseStatus(varbind: any): string {
        const value = this.parseValue(varbind)
        if (!value) return 'Unknown'

        const statusMap: Record<string, string> = {
            '1': 'Online',
            '2': 'Offline',
            '3': 'LOS',
            '4': 'DyingGasp',
        }

        return statusMap[value] || value
    }

    /**
     * Utility: Split array into chunks
     */
    private chunkArray<T>(array: T[], size: number): T[][] {
        const chunks: T[][] = []
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size))
        }
        return chunks
    }

    /**
     * Utility: Sleep
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    /**
     * Report progress
     */
    private reportProgress(
        callback: ((progress: SyncProgress) => void) | undefined,
        progress: SyncProgress
    ): void {
        if (callback) {
            try {
                callback(progress)
            } catch (error) {
                logger.error('Progress callback error', error instanceof Error ? error : new Error(String(error)))
            }
        }
    }
}

// Export singleton instance
export const onuBulkSyncService = new OnuBulkSyncService()
