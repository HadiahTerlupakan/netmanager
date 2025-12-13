import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ARRepository } from '@/lib/repositories/ARRepository'

import FinanceAuthService from '@/lib/services/FinanceAuthService'
const arRepo = new ARRepository(prisma)

export async function GET(request: NextRequest) {
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

        const { searchParams } = new URL(request.url)
        const month = parseInt(searchParams.get('month') || new Date().getMonth().toString()) + 1
        const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())

        const result = await arRepo.calculateCollectionRate(month, year)

        return NextResponse.json(result)
    } catch (error: any) {
        console.error('Error calculating collection rate:', error)
        return NextResponse.json(
            { error: 'Failed to calculate collection rate', details: error.message },
            { status: 500 }
        )
    }
}
