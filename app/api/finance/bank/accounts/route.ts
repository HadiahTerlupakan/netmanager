import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { BankAccountRepository } from '@/lib/repositories/BankAccountRepository'
import FinanceAuthService from '@/lib/services/FinanceAuthService'
import { createAuthError, createAuthorizationError, createSecureError, ErrorType } from '@/lib/utils/secure-error-handler'

const bankAccountRepo = new BankAccountRepository(prisma)

export async function GET(request: NextRequest) {
    try {
        // Proper authentication check
        const authResult = await FinanceAuthService.authenticate(request)
        if (!authResult.success) {
            if (authResult.errorCode === 'FORBIDDEN') {
                return createAuthorizationError(authResult.error)
            }
            return createAuthError(authResult.error)
        }

        // Log financial access
        await FinanceAuthService.logFinancialAccess(
            request,
            authResult.user!,
            'READ',
            'BANK_ACCOUNTS'
        )

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
        return createSecureError(ErrorType.SYSTEM, 'Failed to fetch bank accounts')
    }
}

export async function POST(request: NextRequest) {
    try {
        // Proper authentication check
        const authResult = await FinanceAuthService.authenticate(request)
        if (!authResult.success) {
            if (authResult.errorCode === 'FORBIDDEN') {
                return createAuthorizationError(authResult.error)
            }
            return createAuthError(authResult.error)
        }

        const body = await request.json()

        // Log financial access
        await FinanceAuthService.logFinancialAccess(
            request,
            authResult.user!,
            'CREATE',
            'BANK_ACCOUNT',
            { accountName: body.accountName, bankName: body.bankName }
        )

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
        return createSecureError(ErrorType.SYSTEM, 'Failed to create bank account')
    }
}
