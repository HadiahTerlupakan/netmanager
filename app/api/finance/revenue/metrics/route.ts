import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { MRRService } from '@/lib/services/mrr-service'

const mrrService = new MRRService(prisma)

export async function GET(request: NextRequest) {
    try {
        // Auth check
        const token = request.headers.get('x-finance-token')
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const metrics = await mrrService.calculateCurrentMRR()
        const breakdown = await mrrService.getRevenueBreakdown()

        // Convert BigInt to string
        return NextResponse.json({
            totalMRR: metrics.totalMRR.toString(),
            totalARR: metrics.totalARR.toString(),
            activeCustomers: metrics.activeCustomers,
            arpu: metrics.arpu,
            movements: {
                newMRR: metrics.movements.newMRR.toString(),
                expansionMRR: metrics.movements.expansionMRR.toString(),
                contractionMRR: metrics.movements.contractionMRR.toString(),
                churnMRR: metrics.movements.churnMRR.toString(),
                reactivationMRR: metrics.movements.reactivationMRR.toString()
            },
            breakdown: {
                byPackage: breakdown.byPackage.map((item) => ({
                    ...item,
                    mrr: item.mrr.toString()
                })),
                byArea: breakdown.byArea.map((item) => ({
                    ...item,
                    mrr: item.mrr.toString()
                }))
            }
        })
    } catch (error: any) {
        console.error('Error fetching MRR metrics:', error)
        return NextResponse.json(
            { error: 'Failed to fetch MRR metrics', details: error.message },
            { status: 500 }
        )
    }
}
