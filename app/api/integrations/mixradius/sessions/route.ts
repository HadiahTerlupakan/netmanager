import { NextRequest } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { getMixRadiusService } from '@/modules/integrations/mixradius/MixRadiusService'
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

    const service = getMixRadiusService()
    const activeSessions = await service.fetchActiveSessionsPPP()

    return apiSuccess({
      count: activeSessions.size,
      usernames: Array.from(activeSessions).slice(0, 50), // Return first 50 for debugging
    })
  } catch (error: unknown) {
    console.error('[API] Sessions error:', error)
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return ApiErrors.internalError(message)
  }
}
