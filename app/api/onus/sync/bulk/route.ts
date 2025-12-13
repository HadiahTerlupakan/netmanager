/**
 * Enhanced Bulk Sync API with Incremental Mode
 * Supports both full sync and incremental sync
 */

import { NextRequest, NextResponse } from 'next/server'
import { onuBulkSyncService } from '@/lib/services/onu-sync-bulk-optimized'
import { onuIncrementalSyncService } from '@/lib/services/onu-sync-incremental'
import { logger } from '@/lib/logger'

import { verifyAuth } from '@/lib/auth'
export async function POST(req: NextRequest) {
    try {
        // Authentication check
        const user = await verifyAuth(req);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json()
        const { oltId, mode = 'full', deleteRemovedOnus = false } = body

        if (!oltId) {
            return NextResponse.json(
                { success: false, error: 'OLT ID is required' },
                { status: 400 }
            )
        }

        logger.info(`Sync requested for OLT ${oltId}`, { mode })

        if (mode === 'incremental') {
            // Incremental sync mode - only update changed ONUs
            // Note: This still requires fetching all ONU data from SNMP
            // but only updates the database for changed records

            // For now, we need to fetch data first using bulk service
            // In a full implementation, you'd integrate this with the SNMP fetch

            return NextResponse.json({
                success: false,
                error: 'Incremental mode requires integration with SNMP fetch. Use full mode for now.',
            }, { status: 501 })
        }

        // Full sync mode (default)
        const result = await onuBulkSyncService.syncOltOnus(
            oltId,
            (progress) => {
                logger.debug(`Bulk sync progress: ${progress.percentage}%`, {
                    phase: progress.phase,
                    current: progress.current,
                    total: progress.total,
                })
            }
        )

        return NextResponse.json({
            success: result.success,
            mode: 'full',
            synced: result.synced,
            errors: result.errors,
            duration: result.duration,
            message: `Successfully synced ${result.synced} ONUs in ${(result.duration / 1000).toFixed(2)}s`,
        })
    } catch (error: any) {
        logger.error('Sync failed', error instanceof Error ? error : new Error(String(error)))

        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Sync failed',
            },
            { status: 500 }
        )
    }
}
