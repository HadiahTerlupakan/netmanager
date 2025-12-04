// API for admin to reject manual payment
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'


export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()
        const { rejectionReason, verifiedBy } = body

        if (!rejectionReason) {
            return NextResponse.json(
                { error: 'Rejection reason is required' },
                { status: 400 }
            )
        }

        const manualPayment = await prisma.manualPayment.findUnique({
            where: { id }
        })

        if (!manualPayment) {
            return NextResponse.json(
                { error: 'Manual payment not found' },
                { status: 404 }
            )
        }

        if (manualPayment.status !== 'PENDING') {
            return NextResponse.json(
                { error: 'Payment is not pending' },
                { status: 400 }
            )
        }

        const updatedPayment = await prisma.manualPayment.update({
            where: { id },
            data: {
                status: 'REJECTED',
                rejectionReason,
                verifiedBy: verifiedBy || 'admin',
                verifiedAt: new Date()
            }
        })

        const response = {
            ...updatedPayment,
            amount: updatedPayment.amount.toString()
        }

        return NextResponse.json(response)
    } catch (error) {
        console.error('Error rejecting manual payment:', error)
        return NextResponse.json(
            { error: 'Failed to reject payment' },
            { status: 500 }
        )
    }
}
