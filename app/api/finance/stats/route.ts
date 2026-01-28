import { verifyAuth } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac"
import { FinanceStatsService } from "@/modules/finance/services/FinanceStatsService"
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from "@/lib/api-response"

export const dynamic = 'force-dynamic'

const financeStatsService = new FinanceStatsService()

/**
 * GET - Finance statistics endpoint
 * Refactored to use FinanceStatsService (thin controller pattern)
 */
export async function GET(req: Request) {
    try {
        const user = await verifyAuth(req as any)
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!(await hasPermission("finance:read"))) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat statistik finance')
        }

        const { searchParams } = new URL(req.url)
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
            startDate,
            endDate,
            type,
        })

        return apiSuccess(stats)
    } catch (error) {
        console.error("[FINANCE_STATS_GET]", error)
        return ApiErrors.internalError('Gagal mengambil statistik finance')
    }
}
