import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { MRRService } from '@/lib/services/mrr-service'

import FinanceAuthService from '@/lib/services/FinanceAuthService'
const mrrService = new MRRService(prisma)

export async function POST(request: NextRequest) {
    try {
        // Authentication check
        const authResult = await FinanceAuthService.authenticate(request);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
        }

        // Auth check
        const token = request.headers.get('x-finance-token')
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const snapshot = await mrrService.createRevenueSnapshot()

        return NextResponse.json({
            success: true,
            snapshotId: snapshot.id,
            message: 'Revenue snapshot created successfully'
        })
    } catch (error: any) {
        console.error('Error creating revenue snapshot:', error)
        return NextResponse.json(
            { error: 'Failed to create revenue snapshot', details: error.message },
            { status: 500 }
        )
    }
}
