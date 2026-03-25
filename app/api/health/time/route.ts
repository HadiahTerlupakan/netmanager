import { NextResponse } from 'next/server'
import { getTimezone } from '@/lib/utils/get-timezone'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authConfig)
    const tenantId = session?.user?.tenantId
    
    // Get timezone for this tenant
    const timezone = await getTimezone(tenantId)
    
    return NextResponse.json({
      success: true,
      data: {
        serverTime: new Date().toISOString(),
        timezone: timezone,
        systemTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    })
  } catch (_error) {
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch server time' 
    }, { status: 500 })
  }
}
