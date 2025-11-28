import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { ARRepository } from '@/lib/repositories/ARRepository'

const prisma = new PrismaClient()
const arRepo = new ARRepository(prisma)

export async function GET(request: NextRequest) {
    try {
        // Auth check
        const token = request.headers.get('x-finance-token')
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const report = await arRepo.calculateAgingReport()

        // Convert BigInt to string for JSON
        return NextResponse.json({
            current: report.current.toString(),
            overdue30: report.overdue30.toString(),
            overdue60: report.overdue60.toString(),
            overdue90: report.overdue90.toString(),
            totalOutstanding: report.totalOutstanding.toString(),
            totalCustomers: report.totalCustomers,
            breakdown: [
                {
                    bucket: 'Current (0-30 days)',
                    amount: report.current.toString(),
                    percentage:
                        Number(report.totalOutstanding) > 0
                            ? (Number(report.current) / Number(report.totalOutstanding)) * 100
                            : 0
                },
                {
                    bucket: 'Overdue 1 month (31-60 days)',
                    amount: report.overdue30.toString(),
                    percentage:
                        Number(report.totalOutstanding) > 0
                            ? (Number(report.overdue30) / Number(report.totalOutstanding)) * 100
                            : 0
                },
                {
                    bucket: 'Overdue 2 months (61-90 days)',
                    amount: report.overdue60.toString(),
                    percentage:
                        Number(report.totalOutstanding) > 0
                            ? (Number(report.overdue60) / Number(report.totalOutstanding)) * 100
                            : 0
                },
                {
                    bucket: 'Overdue 3+ months (90+ days)',
                    amount: report.overdue90.toString(),
                    percentage:
                        Number(report.totalOutstanding) > 0
                            ? (Number(report.overdue90) / Number(report.totalOutstanding)) * 100
                            : 0
                }
            ]
        })
    } catch (error: any) {
        console.error('Error calculating aging report:', error)
        return NextResponse.json(
            { error: 'Failed to calculate aging report', details: error.message },
            { status: 500 }
        )
    }
}
