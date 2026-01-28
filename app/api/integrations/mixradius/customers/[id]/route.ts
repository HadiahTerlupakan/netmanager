import { NextRequest } from 'next/server'
import { verifyAuth, getUserPermissions } from '@/lib/auth'
import { getMixRadiusService } from '@/modules/integrations/mixradius'
import { apiSuccess, apiError, ApiErrors, ErrorCodes } from '@/lib/api-response'

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
    const permissions = await getUserPermissions(session.id)
    if (!permissions.includes('mixradius:read')) {
      return ApiErrors.forbidden()
    }

    const { id } = await params

    if (!id) {
      return apiError(ErrorCodes.VALIDATION_ERROR, 'Customer ID is required')
    }

    const service = getMixRadiusService()
    const customerDetail = await service.fetchCustomerDetail(id)

    return apiSuccess({ data: customerDetail })
  } catch (error) {
    console.error('Error fetching customer detail:', error)
    return ApiErrors.internalError(error instanceof Error ? error.message : 'Failed to fetch customer detail')
  }
}
