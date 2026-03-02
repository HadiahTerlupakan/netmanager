import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import { prisma } from '@/lib/prisma'

const secret = new TextEncoder().encode(
    process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'fallback-secret-for-dev'
)

export async function GET(request: Request) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('investor_auth_token')?.value

        if (!token) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const { payload } = await jwtVerify(token, secret)
        const investorId = payload.id as string

        const { searchParams } = new URL(request.url)
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '10')

        const payouts = await prisma.investorPayout.findMany({
            where: { investorId: investorId },
            orderBy: { date: 'desc' },
            skip: (page - 1) * limit,
            take: limit
        })

        const total = await prisma.investorPayout.count({ where: { investorId: payload.id as string } })

        // Serialize BigInts
        const serialized = payouts.map(p => ({
            ...p,
            amount: p.amount.toString()
        }))

        return NextResponse.json({
            data: serialized,
            meta: {
                total,
                page,
                lastPage: Math.ceil(total / limit)
            }
        })
    } catch (error: unknown) {
        console.error('Get Payouts error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json(
            { message: errorMessage },
            { status: errorMessage?.includes('Permission') ? 403 : 500 }
        )
    }
}
