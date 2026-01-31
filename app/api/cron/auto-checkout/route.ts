import { AutoCheckoutService } from '@/modules/attendance/services/AutoCheckoutService'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

export async function POST(_request: Request) {
    try {
        // Basic security check (uncomment for production)
        // const headersList = await headers()
        // const authHeader = headersList.get('authorization')
        // if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        //     return ApiErrors.unauthorized('Cron secret tidak valid')
        // }

        const count = await AutoCheckoutService.runAutoCheckout()

        return apiSuccess({
            checkedOutCount: count,
            timestamp: new Date().toISOString()
        }, { message: 'Auto-checkout berhasil dijalankan' })
    } catch (error: unknown) {
        console.error('Error running auto-checkout:', error)
        const errorMessage = error instanceof Error ? error.message : 'Gagal menjalankan auto-checkout'
        return ApiErrors.internalError(errorMessage)
    }
}

export async function GET(_request: Request) {
    return POST(_request)
}
