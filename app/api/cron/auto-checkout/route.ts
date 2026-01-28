import { AutoCheckoutService } from '@/modules/attendance/services/AutoCheckoutService'
import { headers } from 'next/headers'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
    try {
        const headersList = await headers()
        const authHeader = headersList.get('authorization')
        
        // Basic security check (uncomment for production)
        // if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        //     return ApiErrors.unauthorized('Cron secret tidak valid')
        // }

        const count = await AutoCheckoutService.runAutoCheckout()

        return apiSuccess({
            checkedOutCount: count,
            timestamp: new Date().toISOString()
        }, { message: 'Auto-checkout berhasil dijalankan' })
    } catch (error: any) {
        console.error('Error running auto-checkout:', error)
        return ApiErrors.internalError(error.message || 'Gagal menjalankan auto-checkout')
    }
}

export async function GET(request: Request) {
    return POST(request)
}
