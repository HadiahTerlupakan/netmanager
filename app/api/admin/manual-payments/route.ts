// API for admin to list and manage manual payments
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status') // PENDING, APPROVED, REJECTED

        const where = status ? { status } : {}

        const payments = await prisma.manualPayment.findMany({
            where,
            include: {
                bankAccount: {
                    select: {
                        bankName: true,
                        accountNumber: true,
                        accountName: true
                    }
                },
                tagihan: {
                    select: {
                        id: true,
                        noTagihan: true,
                        periodeBulan: true,
                        periodeTahun: true,
                        total: true,
                        status: true,
                        jatuhTempo: true
                    }
                },
                pelanggan: {
                    select: {
                        id: true,
                        idPelanggan: true,
                        nama: true,
                        email: true,
                        noTelp: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        })

        // Convert BigInt to string for JSON
        const response = payments.map(payment => ({
            ...payment,
            amount: payment.amount.toString()
        }))

        return NextResponse.json(response)
    } catch (error) {
        console.error('Error fetching manual payments:', error)
        return NextResponse.json(
            { error: 'Failed to fetch manual payments' },
            { status: 500 }
        )
    }
}
