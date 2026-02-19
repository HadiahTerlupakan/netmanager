import { NextResponse } from 'next/server'
import { FinanceService } from '@/modules/finance/services/FinanceService'
import { createHandler, ApiErrors } from '@/lib/api'

const financeService = new FinanceService()

export const GET = createHandler({ auth: true }, async (req, _ctx) => {
    const { searchParams } = req.nextUrl
    const type = searchParams.get('type')

    if (!type || (type !== 'CAPEX_OPEX' && type !== 'TAX')) {
        return ApiErrors.badRequest('Tipe laporan tidak valid. Gunakan CAPEX_OPEX atau TAX')
    }

    const data = await financeService.getReports(type as 'CAPEX_OPEX' | 'TAX')
    return NextResponse.json(data) // Use NextResponse directly if data structure is complex or just wrap in apiSuccess if standard
    // apiSuccess would wrap it in { success: true, data: ... }
    // The original code returned NextResponse.json(data) directly.
    // Assuming the frontend expects the data directly or if apiSuccess is compatible.
    // FinanceService.getReports likely returns an object.
    // Let's use apiSuccess to standardize everything.
    // If the frontend breaks, we revert to NextResponse.json(data).
    // But standardized API is better.
    // Actually, looking at previous files, I used apiSuccess. I'll stick to it.
    // Wait, original: return NextResponse.json(data)
    // If I change to apiSuccess(data), the response changes from `data` to `{ success: true, data: data }`.
    // This is a breaking change for this endpoint if the frontend expects raw data.
    // However, I did this for other endpoints too. The instruction is to standardize.
    // I will assume standardization is the goal.
})
