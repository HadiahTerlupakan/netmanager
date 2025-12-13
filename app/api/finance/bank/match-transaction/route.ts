import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { BankReconciliationService } from '@/lib/services/bank-reconciliation-service'

import FinanceAuthService from '@/lib/services/FinanceAuthService'
const reconService = new BankReconciliationService(prisma)

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

        const body = await request.json()
        const { bankStatementId, matchType, entityType, entityId, confidence, matchedBy } = body

        if (!bankStatementId || !matchType || !entityType || !entityId) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            )
        }

        await reconService.createMatch(
            bankStatementId,
            matchType,
            entityType,
            entityId,
            confidence || 1.0,
            matchedBy
        )

        return NextResponse.json({
            success: true,
            message: 'Transaction matched successfully'
        })
    } catch (error: any) {
        console.error('Error creating match:', error)
        return NextResponse.json(
            { error: 'Failed to create match', details: error.message },
            { status: 500 }
        )
    }
}
