// API for specific Company Bank Account (Admin Update/Delete)
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

import { verifyAuth } from '@/lib/auth'
interface RouteContext {
    params: Promise<{ id: string }>
}

// PUT - Update bank account
export async function PUT(
    request: NextRequest,
    context: RouteContext
) {
    try {
        // Authentication check
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await context.params
        const body = await request.json()
        const { bankName, accountNumber, accountName, description, isActive, priority } = body

        const account = await prisma.companyBankAccount.update({
            where: { id },
            data: {
                ...(bankName && { bankName }),
                ...(accountNumber && { accountNumber }),
                ...(accountName && { accountName }),
                ...(description !== undefined && { description }),
                ...(isActive !== undefined && { isActive }),
                ...(priority !== undefined && { priority }),
            }
        })

        return NextResponse.json(account)
    } catch (error) {
        console.error('Error updating bank account:', error)
        return NextResponse.json(
            { error: 'Failed to update bank account' },
            { status: 500 }
        )
    }
}

// DELETE - Delete bank account
export async function DELETE(
    request: NextRequest,
    context: RouteContext
) {
    try {
        // Authentication check
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await context.params

        // Check if account has any manual payments
        const paymentsCount = await prisma.manualPayment.count({
            where: { bankAccountId: id }
        })

        if (paymentsCount > 0) {
            return NextResponse.json(
                { error: 'Cannot delete account with existing payments' },
                { status: 400 }
            )
        }

        await prisma.companyBankAccount.delete({
            where: { id }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting bank account:', error)
        return NextResponse.json(
            { error: 'Failed to delete bank account' },
            { status: 500 }
        )
    }
}
