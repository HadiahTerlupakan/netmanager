import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { BankAccountRepository } from '@/lib/repositories/BankAccountRepository'

const prisma = new PrismaClient()
const bankAccountRepo = new BankAccountRepository(prisma)

type RouteContext = {
    params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const token = request.headers.get('x-finance-token')
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await context.params
        const account = await bankAccountRepo.findById(id)

        if (!account) {
            return NextResponse.json({ error: 'Bank account not found' }, { status: 404 })
        }

        return NextResponse.json({
            ...account,
            balance: account.balance.toString()
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
        const token = request.headers.get('x-finance-token')
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
        const token = request.headers.get('x-finance-token')
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
