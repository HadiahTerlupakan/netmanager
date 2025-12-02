// API for admin to approve manual payment
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const prisma = new PrismaClient()

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()
        const { verifiedBy } = body // Admin user ID

        // Get manual payment with related data
        const manualPayment = await prisma.manualPayment.findUnique({
            where: { id },
            include: {
                tagihan: true
            }
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

        // Update manual payment status and tagihan in a transaction
        const result = await prisma.$transaction(async (tx) => {
            // Update manual payment
            const updatedPayment = await tx.manualPayment.update({
                where: { id },
                data: {
                    status: 'APPROVED',
                    verifiedBy: verifiedBy || 'admin',
                    verifiedAt: new Date()
                }
            })

            // Update tagihan status to LUNAS
            await tx.tagihan.update({
                where: { id: manualPayment.tagihanId },
                data: {
                    status: 'LUNAS',
                    tanggalBayar: new Date(),
                    metodePembayaran: 'TRANSFER_MANUAL'
                }
            })

            return updatedPayment
        })

        const response = {
            ...result,
            amount: result.amount.toString()
        }

        return NextResponse.json(response)
    } catch (error) {
        console.error('Error approving manual payment:', error)
        return NextResponse.json(
            { error: 'Failed to approve payment' },
            { status: 500 }
        )
    }
}
