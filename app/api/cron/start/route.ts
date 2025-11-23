/**
 * API endpoint untuk start scheduler secara manual
 * POST /api/cron/start
 * 
 * Scheduler akan auto-start saat aplikasi start (di lib/prisma.ts)
 * Endpoint ini untuk start manual jika diperlukan
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { startAllSchedulers } from '@/lib/cron/start-scheduler'

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session: any = await getServerSession(authConfig as any)
    if (!session || session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Start semua scheduler (OLT sync, ONU sync, MikroTik ping)
    startAllSchedulers()
    
    return NextResponse.json({
      success: true,
      message: 'All schedulers started successfully',
    })
  } catch (error: any) {
    console.error('[Cron-Start-API] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to start schedulers',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

