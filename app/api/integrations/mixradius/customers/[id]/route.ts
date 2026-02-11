import { NextRequest } from 'next/server'
import { verifyAuth, getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { getMixRadiusService } from '@/modules/integrations'
import { apiSuccess, apiError, ApiErrors, ErrorCodes } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await verifyAuth(request)
    if (!session) {
      return ApiErrors.unauthorized()
    }

    // Add RBAC permission check
    const user = session as { id: string; role?: string; isSuperAdmin?: boolean }
    const isSuper = isSuperAdmin(user)

    if (!isSuper) {
      const permissions = await getUserPermissions(session.id)
      const hasAccess = permissions.includes('mixradius:read') || permissions.includes('*')
      if (!hasAccess) {
        return ApiErrors.forbidden('Anda tidak memiliki akses ke data MixRadius')
      }
    }

    const { id } = await params

    if (!id) {
      return apiError('ID Pelanggan wajib disertakan', ErrorCodes.VALIDATION_ERROR)
    }

    const service = getMixRadiusService()
    const customerDetail = await service.fetchCustomerDetail(id)

    return apiSuccess(customerDetail)
  } catch (error) {
    console.error('Error fetching customer detail:', error)
    return ApiErrors.internalError(error instanceof Error ? error.message : 'Gagal mengambil detail pelanggan')
  }
}
