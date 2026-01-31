import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { FinanceService } from '@/modules/finance/services/FinanceService'

const financeService = new FinanceService()

export async function GET(req: NextRequest) {
    const session = await verifyAuth(req)
    if (!session) return new NextResponse('Unauthorized', { status: 401 })

    try {
        const { searchParams } = new URL(req.url)
        const type = searchParams.get('type')

        if (!type || (type !== 'CAPEX_OPEX' && type !== 'TAX')) {
            return new NextResponse('Invalid report type', { status: 400 })
        }

        const data = await financeService.getReports(type as 'CAPEX_OPEX' | 'TAX')
        return NextResponse.json(data)

    } catch (error: unknown) {
        console.error('Report Error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Error generating report'
        return new NextResponse(errorMessage, { status: 500 })
    }
}
