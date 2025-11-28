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

        const report = await reportsService.generateCashFlow(month, year)

        // Convert BigInt to string
        return NextResponse.json({
            period: report.period,
            operatingActivities: {
                cashFromCustomers: report.operatingActivities.cashFromCustomers.toString(),
                cashToSuppliers: report.operatingActivities.cashToSuppliers.toString(),
                netOperating: report.operatingActivities.netOperating.toString()
            },
            investingActivities: {
                equipmentPurchases: report.investingActivities.equipmentPurchases.toString(),
                netInvesting: report.investingActivities.netInvesting.toString()
            },
            financingActivities: {
                loansReceived: report.financingActivities.loansReceived.toString(),
                loanRepayments: report.financingActivities.loanRepayments.toString(),
                netFinancing: report.financingActivities.netFinancing.toString()
            },
            netCashFlow: report.netCashFlow.toString(),
            openingCash: report.openingCash.toString(),
            closingCash: report.closingCash.toString()
        })
    } catch (error: any) {
        console.error('Error generating cash flow report:', error)
        return NextResponse.json(
            { error: 'Failed to generate cash flow report', details: error.message },
            { status: 500 }
        )
    }
}
