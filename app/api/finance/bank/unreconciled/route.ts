import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { BankStatementRepository } from '@/lib/repositories/BankStatementRepository'
import FinanceAuthService from '@/lib/services/FinanceAuthService'

const bankStatementRepo = new BankStatementRepository(prisma)

export async function GET(request: NextRequest) {
    try {
        // Authentication check
        const authResult = await FinanceAuthService.authenticate(request)
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const bankAccountId = searchParams.get('bankAccountId') || undefined

        const statements = await bankStatementRepo.findUnreconciled(bankAccountId)

        // Convert BigInt to string
        const data = statements.map((stmt) => ({
            ...stmt,
            debit: stmt.debit.toString(),
            credit: stmt.credit.toString(),
            balance: stmt.balance.toString()
        }))

        return NextResponse.json({ data })
    } catch (error: any) {
        console.error('Error fetching unreconciled statements:', error)
        return NextResponse.json(
            { error: 'Failed to fetch unreconciled statements', details: error.message },
            { status: 500 }
        )
    }
}
