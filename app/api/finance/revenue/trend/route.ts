import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { MRRService } from '@/lib/services/mrr-service'

const prisma = new PrismaClient()
const mrrService = new MRRService(prisma)

export async function GET(request: NextRequest) {
    try {
        // Auth check
        const token = request.headers.get('x-finance-token')
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const limit = parseInt(searchParams.get('limit') || '12')

        const snapshots = await mrrService.getRevenueSnapshots(limit)

        // Convert BigInt to string
        const data = snapshots.map((snapshot) => ({
            ...snapshot,
            totalMRR: snapshot.totalMRR.toString(),
            totalARR: snapshot.totalARR.toString(),
            newMRR: snapshot.newMRR.toString(),
            expansionMRR: snapshot.expansionMRR.toString(),
            contractionMRR: snapshot.contractionMRR.toString(),
            churnMRR: snapshot.churnMRR.toString(),
            reactivationMRR: snapshot.reactivationMRR.toString()
        }))

        return NextResponse.json({ data })
    } catch (error: any) {
        console.error('Error fetching revenue trend:', error)
        return NextResponse.json(
            { error: 'Failed to fetch revenue trend', details: error.message },
            { status: 500 }
        )
    }
}
