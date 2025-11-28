import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { BankReconciliationService } from '@/lib/services/bank-reconciliation-service'

const prisma = new PrismaClient()
const reconService = new BankReconciliationService(prisma)

export async function POST(request: NextRequest) {
    try {
        // Auth check
        const token = request.headers.get('x-finance-token')
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { amount, transactionDate, description, isCredit } = body

        if (!amount || !transactionDate) {
            return NextResponse.json(
                { error: 'Missing required fields: amount, transactionDate' },
                { status: 400 }
            )
        }

        // Find match candidates
        const candidates = await reconService.findMatchCandidates(
            BigInt(amount),
            new Date(transactionDate),
            description || '',
            isCredit
        )

        // Convert BigInt to string for JSON
        const data = candidates.map((candidate) => ({
            ...candidate,
            amount: candidate.amount.toString()
        }))

        return NextResponse.json({
            candidates: data,
            count: data.length,
            message: data.length > 0 ? `Found ${data.length} potential matches` : 'No matches found'
        })
    } catch (error: any) {
        console.error('Error finding match candidates:', error)
        return NextResponse.json(
            { error: 'Failed to find match candidates', details: error.message },
            { status: 500 }
        )
    }
}
