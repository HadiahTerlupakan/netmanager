// API for manual payment submission by customers
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const {
            tagihanId,
            pelangganId,
            bankAccountId,
            amount,
            senderName,
            transferDate,
            proofImageUrl,
            notes
        } = body

        // Validate required fields
        if (!tagihanId || !pelangganId || !bankAccountId || !amount || !senderName || !transferDate || !proofImageUrl) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            )
        }

        // Verify tagihan exists and belongs to customer
        const tagihan = await prisma.tagihan.findFirst({
            where: {
                id: tagihanId,
                pelangganId: pelangganId,
            }
        })

        if (!tagihan) {
            return NextResponse.json(
                { error: 'Invoice not found or does not belong to customer' },
                { status: 404 }
            )
        }

        // Check if tagihan is already paid
        if (tagihan.status === 'LUNAS') {
            return NextResponse.json(
                { error: 'Invoice is already paid' },
                { status: 400 }
            )
        }

        // Check if there's already a pending manual payment for this tagihan
        const existingPayment = await prisma.manualPayment.findFirst({
            where: {
                tagihanId,
                status: 'PENDING'
            }
        })

        if (existingPayment) {
            return NextResponse.json(
                { error: 'There is already a pending manual payment for this invoice' },
                { status: 400 }
            )
        }

        // Verify bank account exists and is active
        const bankAccount = await prisma.companyBankAccount.findFirst({
            where: {
                id: bankAccountId,
                isActive: true
            }
        })

        if (!bankAccount) {
            return NextResponse.json(
                { error: 'Bank account not found or inactive' },
                { status: 404 }
            )
        }

        // Create manual payment record
        const manualPayment = await prisma.manualPayment.create({
            data: {
                tagihanId,
                pelangganId,
                bankAccountId,
                amount: BigInt(amount),
                senderName,
                transferDate: new Date(transferDate),
                proofImageUrl,
                notes,
                status: 'PENDING'
            },
            include: {
                bankAccount: true,
                tagihan: {
                    include: {
                        pelanggan: {
                            select: {
                                nama: true,
                                email: true,
                                noTelp: true
                            }
                        }
                    }
                }
            }
        })

        // Convert BigInt to string for JSON serialization
        const response = {
            ...manualPayment,
            amount: manualPayment.amount.toString()
        }

        return NextResponse.json(response, { status: 201 })
    } catch (error) {
        console.error('Error submitting manual payment:', error)
        return NextResponse.json(
            { error: 'Failed to submit manual payment' },
            { status: 500 }
        )
    }
}

// GET - Get customer's manual payments
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const pelangganId = searchParams.get('pelangganId')

        if (!pelangganId) {
            return NextResponse.json(
                { error: 'Customer ID is required' },
                { status: 400 }
            )
        }

        const payments = await prisma.manualPayment.findMany({
            where: {
                pelangganId
            },
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
                        noTagihan: true,
                        periodeBulan: true,
                        periodeTahun: true,
                        total: true,
                        status: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        })

        // Convert BigInt to string
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
