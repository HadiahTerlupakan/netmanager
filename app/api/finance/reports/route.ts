import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { FinanceService } from '@/modules/finance/services/FinanceService'
import { z } from 'zod'

const financeService = new FinanceService()

const reportSchema = z.object({
    type: z.enum(['CAPEX_OPEX', 'TAX'])
})

export async function GET(req: Request) {
    const session = await verifyAuth(req as any)
    if (!session) return new NextResponse('Unauthorized', { status: 401 })

    try {
        const { searchParams } = new URL(req.url)
        const type = searchParams.get('type')
        
        if (!type || (type !== 'CAPEX_OPEX' && type !== 'TAX')) {
            return new NextResponse('Invalid report type', { status: 400 })
        }

        const data = await financeService.getReports(type as 'CAPEX_OPEX' | 'TAX')
        return NextResponse.json(data)

    } catch (error: any) {
        console.error('Report Error:', error)
        return new NextResponse(error.message || 'Error generating report', { status: 500 })
    }
}
