import { hasPermission } from "@/lib/rbac"
import { FinanceStatsService } from "@/modules/finance/services/FinanceStatsService"
import { createHandler, apiSuccess, ApiErrors, ErrorCodes, apiError } from "@/lib/api"

export const dynamic = 'force-dynamic'

const financeStatsService = new FinanceStatsService()

/**
 * GET - Finance statistics endpoint
 * Refactored to use FinanceStatsService (thin controller pattern)
 */
export const GET = createHandler({ auth: true }, async (req, _ctx) => {
    if (!(await hasPermission("finance:read"))) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat statistik finance')
    }

    const { searchParams } = req.nextUrl
    const startDate = searchParams.get("startDate") || undefined
    const endDate = searchParams.get("endDate") || undefined
    const type = searchParams.get("type") || "daily"

    if (startDate && endDate) {
        const start = new Date(startDate)
        const end = new Date(endDate)
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return apiError('Format tanggal tidak valid', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }
    }

    const stats = await financeStatsService.getStats({
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
        type,
    })

    return apiSuccess(stats)
})
