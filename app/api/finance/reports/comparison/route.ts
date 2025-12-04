import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { FinancialReportsService } from '@/lib/services/financial-reports-service'

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

        const comparison = await reportsService.getMonthComparison(month, year)

        // Convert BigInt to string for both current and previous
        const serializePL = (pl: any) => ({
            period: pl.period,
            revenue: {
                total: pl.revenue.total.toString(),
                breakdown: {
                    subscriptions: pl.revenue.breakdown.subscriptions.toString(),
                    manualIncome: pl.revenue.breakdown.manualIncome.toString()
                }
            },
            expenses: {
                total: pl.expenses.total.toString(),
                opex: pl.expenses.opex.toString(),
                capex: pl.expenses.capex.toString(),
                breakdown: pl.expenses.breakdown.map((item: any) => ({
                    ...item,
                    amount: item.amount.toString()
                }))
            },
            grossProfit: pl.grossProfit.toString(),
            netProfit: pl.netProfit.toString(),
            profitMargin: pl.profitMargin
        })

        return NextResponse.json({
            current: serializePL(comparison.current),
            previous: serializePL(comparison.previous),
            changes: {
                revenue: {
                    amount: comparison.changes.revenue.amount.toString(),
                    percentage: comparison.changes.revenue.percentage
                },
                profit: {
                    amount: comparison.changes.profit.amount.toString(),
                    percentage: comparison.changes.profit.percentage
                }
            }
        })
    } catch (error: any) {
        console.error('Error generating comparison:', error)
        return NextResponse.json(
            { error: 'Failed to generate comparison', details: error.message },
            { status: 500 }
        )
    }
}
