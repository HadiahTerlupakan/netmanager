import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { MixRadiusService } from '@/modules/integrations/mixradius/MixRadiusService'

/**
 * GET /api/integrations/mixradius/sessions
 * 
 * Mendapatkan daftar active PPP sessions dari MixRadius
 */
export async function GET(req: NextRequest) {
  try {
    // Auth check
    const session = await verifyAuth(req)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const service = new MixRadiusService()
    const activeSessions = await service.fetchActiveSessionsPPP()

    return NextResponse.json({
      success: true,
      count: activeSessions.size,
      usernames: Array.from(activeSessions).slice(0, 50), // Return first 50 for debugging
    })
  } catch (error: any) {
    console.error('[API] Sessions error:', error)
    return NextResponse.json({ 
      error: error.message,
      success: false 
    }, { status: 500 })
  }
}
