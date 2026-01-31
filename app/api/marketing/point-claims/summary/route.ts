import { NextRequest } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { isSuperAdminRole } from '@/lib/auth-helpers'
import { getPointClaimService } from '@/lib/repositories'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

// GET - Get point summary for current user or specific sales
export async function GET(req: NextRequest) {
  try {
    const session = await verifyAuth(req)
    if (!session) return ApiErrors.unauthorized('Session tidak valid')

    const { searchParams } = new URL(req.url)
    let salesId = searchParams.get('salesId') || session.id

    const isSuperAdmin = isSuperAdminRole(session.role)
    if (!isSuperAdmin && salesId !== session.id) {
      salesId = session.id
    }

    const service = getPointClaimService()
    const summary = await service.getPointSummary(salesId)

    return apiSuccess(summary)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Gagal mengambil summary points'
    return ApiErrors.internalError(errorMessage)
  }
}
