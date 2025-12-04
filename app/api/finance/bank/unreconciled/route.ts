import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { BankStatementRepository } from '@/lib/repositories/BankStatementRepository'

const bankStatementRepo = new BankStatementRepository(prisma)

export async function GET(request: NextRequest) {
    try {
        // Auth check
        const token = request.headers.get('x-finance-token')
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
