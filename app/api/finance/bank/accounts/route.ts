import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { BankAccountRepository } from '@/lib/repositories/BankAccountRepository'

const bankAccountRepo = new BankAccountRepository(prisma)

export async function GET(request: NextRequest) {
    try {
        // Auth check
        const token = request.headers.get('x-finance-token')
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const activeOnly = searchParams.get('active') === 'true'

        const accounts = activeOnly
            ? await bankAccountRepo.findActive()
            : await bankAccountRepo.findAll()

        // Convert BigInt to string for JSON
        const data = accounts.map((acc) => ({
            ...acc,
            balance: acc.balance.toString()
        }))

        return NextResponse.json({ data })
    } catch (error: any) {
        console.error('Error fetching bank accounts:', error)
        return NextResponse.json(
            { error: 'Failed to fetch bank accounts', details: error.message },
            { status: 500 }
        )
    }
}

export async function POST(request: NextRequest) {
    try {
        // Auth check
        const token = request.headers.get('x-finance-token')
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()

        // Validation
        if (!body.accountName || !body.bankName || !body.accountNumber) {
            return NextResponse.json(
                { error: 'Missing required fields: accountName, bankName, accountNumber' },
                { status: 400 }
            )
        }

        const result = await bankAccountRepo.create(body)

        return NextResponse.json(
            { success: true, id: result.id, message: 'Bank account created successfully' },
            { status: 201 }
        )
    } catch (error: any) {
        console.error('Error creating bank account:', error)
        return NextResponse.json(
            { error: 'Failed to create bank account', details: error.message },
            { status: 500 }
        )
    }
}
