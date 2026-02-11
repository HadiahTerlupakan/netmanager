import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { FinanceService } from '@/modules/finance/services/FinanceService'
import { ApiErrors } from '@/lib/api-response'

const financeService = new FinanceService()

export async function GET(req: NextRequest) {
    const session = await verifyAuth(req)
    if (!session) return ApiErrors.unauthorized()

    try {
        const { searchParams } = new URL(req.url)
        const type = searchParams.get('type')

        if (!type || (type !== 'CAPEX_OPEX' && type !== 'TAX')) {
            return ApiErrors.badRequest('Tipe laporan tidak valid. Gunakan CAPEX_OPEX atau TAX')
        }

        const data = await financeService.getReports(type as 'CAPEX_OPEX' | 'TAX')
        return NextResponse.json(data)

    } catch (error: unknown) {
        console.error('Report Error:', error)
        const message = error instanceof Error ? error.message : 'Gagal membuat laporan'
        return ApiErrors.internalError(message)
    }
}
