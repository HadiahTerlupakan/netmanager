import { NextRequest } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { MixRadiusService } from '@/modules/integrations/mixradius/MixRadiusService'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

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
      return ApiErrors.unauthorized()
    }

    const service = new MixRadiusService()
    const activeSessions = await service.fetchActiveSessionsPPP()

    return apiSuccess({
      count: activeSessions.size,
      usernames: Array.from(activeSessions).slice(0, 50), // Return first 50 for debugging
    })
  } catch (error: any) {
    console.error('[API] Sessions error:', error)
    return ApiErrors.internalError(error.message || 'Internal Server Error')
  }
}
