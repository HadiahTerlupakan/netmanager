import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { FinancialReportsService } from '@/lib/services/financial-reports-service'

const prisma = new PrismaClient()
const reportsService = new FinancialReportsService(prisma)

export async function GET(request: NextRequest) {
    try {
        // Auth check
        const token = request.headers.get('x-finance-token')
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))
        const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))

        const report = await reportsService.generateProfitLoss(month, year)

        // Convert BigInt to string
        return NextResponse.json({
            period: report.period,
            revenue: {
                total: report.revenue.total.toString(),
                breakdown: {
                    subscriptions: report.revenue.breakdown.subscriptions.toString(),
                    manualIncome: report.revenue.breakdown.manualIncome.toString()
                }
            },
            expenses: {
                total: report.expenses.total.toString(),
                opex: report.expenses.opex.toString(),
                capex: report.expenses.capex.toString(),
                breakdown: report.expenses.breakdown.map(item => ({
                    ...item,
                    amount: item.amount.toString()
                }))
            },
            grossProfit: report.grossProfit.toString(),
            netProfit: report.netProfit.toString(),
            profitMargin: report.profitMargin
        })
    } catch (error: any) {
        console.error('Error generating P&L report:', error)
        return NextResponse.json(
            { error: 'Failed to generate P&L report', details: error.message },
            { status: 500 }
        )
    }
}
