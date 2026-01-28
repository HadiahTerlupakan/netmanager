import { NextRequest } from 'next/server'
import { requireCustomerAuth } from '@/lib/customer-auth'
import { CustomerUsageService } from '@/modules/pelanggan/services/CustomerUsageService'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

const usageService = new CustomerUsageService()

/**
 * GET - Get customer connection status and usage data
 */
export async function GET(request: NextRequest) {
    try {
        const authResult = await requireCustomerAuth(request)
        if (authResult.response) {
            return authResult.response
        }

        const usageData = await usageService.getUsageData(authResult.session.id)

        return apiSuccess(usageData)
    } catch (error: any) {
        console.error('[Customer Usage Error]:', error)
        
        if (error.message === 'Data pelanggan tidak ditemukan') {
            return ApiErrors.notFound('Pelanggan')
        }
        
        return ApiErrors.internalError(error.message || 'Terjadi kesalahan server')
    }
}
