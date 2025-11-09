/**
 * API endpoint untuk sync data ONU dari SNMP ke database
 * POST /api/olts/onus/sync - Sync semua OLT
 * POST /api/olts/onus/sync?oltId=xxx - Sync OLT tertentu
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { syncOnuDataFromOlt, syncAllOnuData } from '@/lib/services/onu-sync'

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session: any = await getServerSession(authConfig as any)
    if (!session || session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const oltId = searchParams.get('oltId')

    if (oltId) {
      // Sync OLT tertentu
      console.log(`[ONU-Sync-API] Manual sync requested for OLT: ${oltId}`)
      const count = await syncOnuDataFromOlt(oltId)
      return NextResponse.json({
        success: true,
        message: `Successfully synced ${count} ONUs`,
        count,
        oltId,
      })
    } else {
      // Sync semua OLT
      console.log(`[ONU-Sync-API] Manual sync requested for all OLTs`)
      const count = await syncAllOnuData()
      return NextResponse.json({
        success: true,
        message: `Successfully synced ${count} ONUs from all OLTs`,
        count,
      })
    }
  } catch (error: any) {
    console.error('[ONU-Sync-API] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to sync ONU data',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

