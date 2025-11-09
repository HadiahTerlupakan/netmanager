/**
 * API endpoint untuk start scheduler secara manual
 * POST /api/cron/start
 * 
 * NOTE: Fitur sync sementara dinonaktifkan
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
// import { startAllSchedulers } from '@/lib/cron/start-scheduler'

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session: any = await getServerSession(authConfig as any)
    if (!session || session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Scheduler disabled - fitur sync sementara dinonaktifkan
    // startAllSchedulers()
    
    return NextResponse.json({
      success: true,
      message: 'Scheduler feature is currently disabled',
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

