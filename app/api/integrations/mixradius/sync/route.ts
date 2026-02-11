
import { NextRequest } from 'next/server'
import { verifyAuth, getUserPermissions, isSuperAdmin } from '@/lib/auth'
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
    const user = session as { id: string; role?: string; isSuperAdmin?: boolean }
    const isSuper = isSuperAdmin(user)

    if (!isSuper) {
      const permissions = await getUserPermissions(session.id)
      const hasAccess = permissions.includes('mixradius:read') || permissions.includes('*')
      if (!hasAccess) {
        return ApiErrors.forbidden('Anda tidak memiliki akses ke MixRadius')
      }
    }

    // 3. Parse Body
    // Expecting the full MixRadius customer object from the frontend
    const body = await req.json()
    const customerData = body as MixRadiusCustomerDetail

    if (!customerData || !customerData.id || !customerData.username) {
        return apiError(
          'Data pelanggan tidak valid. Pastikan ID dan Username tersedia.',
          ErrorCodes.VALIDATION_ERROR,
          { details: { missingFields: [!customerData?.id ? 'ID Pelanggan' : '', !customerData?.username ? 'Username' : ''].filter(Boolean) } }
        )
    }

    // 4. Perform Sync
    const result = await syncService.syncCustomer(customerData)

    return apiSuccess({
        action: result.action,
        localId: result.customer.id,
        customer: result.customer,
        message: result.action === 'created' ? 'Berhasil membuat data pelanggan' : 'Berhasil memperbarui data pelanggan'
    })

  } catch (error: unknown) {
    console.error('[API] MixRadius Sync Error:', error)
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan server'
    return ApiErrors.internalError(message)
  }
}
