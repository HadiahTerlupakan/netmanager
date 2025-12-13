import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { BankAccountRepository } from '@/lib/repositories/BankAccountRepository'
import FinanceAuthService from '@/lib/services/FinanceAuthService'

const bankAccountRepo = new BankAccountRepository(prisma)

type RouteContext = {
    params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
    try {
        // Authentication check
        const authResult = await FinanceAuthService.authenticate(request)
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 })
        }

        const { id } = await context.params
        const account = await bankAccountRepo.findById(id)

        if (!account) {
            return NextResponse.json({ error: 'Bank account not found' }, { status: 404 })
        }

        return NextResponse.json({
            ...account,
            saldoSaatIni: account.saldoSaatIni.toString(),
            saldoAwal: account.saldoAwal.toString()
        })
    } catch (error: any) {
        console.error('Error fetching bank account:', error)
        return NextResponse.json(
            { error: 'Failed to fetch bank account', details: error.message },
            { status: 500 }
        )
    }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
    try {
        // Authentication check
        const authResult = await FinanceAuthService.authenticate(request)
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 })
        }

        const { id } = await context.params
        const body = await request.json()

        await bankAccountRepo.update(id, body)

        return NextResponse.json({
            success: true,
            message: 'Bank account updated successfully'
        })
    } catch (error: any) {
        console.error('Error updating bank account:', error)
        return NextResponse.json(
            { error: 'Failed to update bank account', details: error.message },
            { status: 500 }
        )
    }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
    try {
        // Authentication check
        const authResult = await FinanceAuthService.authenticate(request)
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 })
        }

        const { id } = await context.params
        await bankAccountRepo.delete(id)

        return NextResponse.json({
            success: true,
            message: 'Bank account deleted successfully'
        })
    } catch (error: any) {
        console.error('Error deleting bank account:', error)
        return NextResponse.json(
            { error: 'Failed to delete bank account', details: error.message },
            { status: 500 }
        )
    }
}
