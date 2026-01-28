import { NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac"
import { FinanceStatsService } from "@/modules/finance/services/FinanceStatsService"

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
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        if (!(await hasPermission("finance:read"))) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const { searchParams } = new URL(req.url)
        const startDate = searchParams.get("startDate") || undefined
        const endDate = searchParams.get("endDate") || undefined
        const type = searchParams.get("type") || "daily"

        // Validate dates if provided
        if (startDate && endDate) {
            const start = new Date(startDate)
            const end = new Date(endDate)
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                return NextResponse.json({ error: "Invalid date format" }, { status: 400 })
            }
        }

        const stats = await financeStatsService.getStats({
            startDate,
            endDate,
            type,
        })

        return NextResponse.json(stats)
    } catch (error) {
        console.error("[FINANCE_STATS_GET]", error)
        return NextResponse.json({ error: "Internal Error" }, { status: 500 })
    }
}
