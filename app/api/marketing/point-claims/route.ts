import { NextRequest } from 'next/server'
import { verifyAuth, getUserPermissions } from '@/lib/auth'
import { isSuperAdminRole } from '@/lib/auth-helpers'
import { getPointClaimService } from '@/lib/repositories'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

// GET - List all claims (admin) atau claims by sales (mobile)
export async function GET(req: NextRequest) {
  try {
    const session = await verifyAuth(req)
    if (!session) return ApiErrors.unauthorized('Session tidak valid')

    const isSuperAdmin = isSuperAdminRole(session.role)
    const permissions = await getUserPermissions(session.id)
    const canReadAll = isSuperAdmin || permissions.includes('canvasing:read') || permissions.includes('point_claims:read')

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') as any
    let salesId = searchParams.get('salesId') || undefined

    if (!canReadAll) {
      salesId = session.id
    }

    const service = getPointClaimService()
    const claims = await service.getAllClaims({ status, salesId })

    return apiSuccess(claims)
  } catch (error: any) {
    return ApiErrors.internalError(error.message || 'Gagal mengambil data claims')
  }
}
