import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensurePermission } from '@/lib/rbac'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await ensurePermission('investors:read')

        const { id } = await params
        const { searchParams } = new URL(request.url)
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '10')

        const payouts = await prisma.investorPayout.findMany({
            where: { investorId: id },
            orderBy: { date: 'desc' },
            skip: (page - 1) * limit,
            take: limit
        })

        const total = await prisma.investorPayout.count({ where: { investorId: id } })

        return NextResponse.json({
            data: payouts,
            meta: {
                total,
                page,
                lastPage: Math.ceil(total / limit)
            }
        })
    } catch (error: unknown) {
        console.error('Get Investor Payouts error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json(
            { message: errorMessage },
            { status: errorMessage?.includes('Permission') ? 403 : 500 }
        )
    }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await ensurePermission('investors:create')

        const { id } = await params
        const body = await request.json()
        const { amount, date, bankName, accountNumber, accountName, reference, notes, status } = body

        if (!amount || isNaN(Number(amount))) {
            return NextResponse.json({ message: 'Nominal tidak valid' }, { status: 400 })
        }

        const investor = await prisma.investor.findUnique({ where: { id } })
        if (!investor) {
            return NextResponse.json({ message: 'Investor tidak ditemukan' }, { status: 404 })
        }

        const payout = await prisma.investorPayout.create({
            data: {
                investorId: id,
                amount: BigInt(amount),
                date: date ? new Date(date) : new Date(),
                bankName,
                accountNumber,
                accountName,
                reference,
                notes,
                status: status || 'COMPLETED'
            }
        })

        // Serialize BigInt for JSON response
        const serialized = {
            ...payout,
            amount: payout.amount.toString()
        }

        return NextResponse.json(serialized, { status: 201 })
    } catch (error: unknown) {
        console.error('Post Investor Payout error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json(
            { message: errorMessage },
            { status: errorMessage?.includes('Permission') ? 403 : 500 }
        )
    }
}
