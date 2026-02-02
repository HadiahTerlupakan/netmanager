
import { NextRequest } from 'next/server'
import { verifyAuth, getUserPermissions } from '@/lib/auth'
import { syncService } from '@/modules/integrations/services/MixRadiusSyncService'
import type { MixRadiusCustomerDetail } from '@/modules/integrations/services/MixRadiusService'
import { apiSuccess, apiError, ApiErrors, ErrorCodes } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    // 1. Auth Check
    const session = await verifyAuth(req)
    if (!session) {
      return ApiErrors.unauthorized()
    }

    // 2. Permission Check
    const permissions = await getUserPermissions(session.id)
    if (!permissions.includes('mixradius:read')) {
      return ApiErrors.forbidden()
    }

    // 3. Parse Body
    // Expecting the full MixRadius customer object from the frontend
    const body = await req.json()
    const customerData = body as MixRadiusCustomerDetail

    if (!customerData || !customerData.id || !customerData.username) {
        return apiError(ErrorCodes.VALIDATION_ERROR, 'Invalid data provided')
    }

    // 4. Perform Sync
    const result = await syncService.syncCustomer(customerData)

    return apiSuccess({
        action: result.action,
        localId: result.customer.id,
        customer: result.customer,
        message: `Successfully ${result.action} customer record`
    })

  } catch (error: unknown) {
    console.error('[API] MixRadius Sync Error:', error)
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return ApiErrors.internalError(message)
  }
}
