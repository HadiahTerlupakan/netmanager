import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { ARRepository } from '@/lib/repositories/ARRepository'

const prisma = new PrismaClient()
const arRepo = new ARRepository(prisma)

export async function GET(request: NextRequest) {
    try {
        // Auth check - verify Finance user
        const token = request.headers.get('x-finance-token')
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // TODO: Verify token dengan finance session
        // For now, skip verification

        const { searchParams } = new URL(request.url)
        const area = searchParams.get('area') || undefined
        const paketId = searchParams.get('paketId') || undefined
        const agingBucket = searchParams.get('agingBucket') || undefined
        const limit = parseInt(searchParams.get('limit') || '100')
        const offset = parseInt(searchParams.get('offset') || '0')

        const result = await arRepo.findOutstanding({
            area,
            paketId,
            agingBucket,
            limit,
            offset
        })

        // Convert BigInt to string for JSON serialization
        const data = result.data.map((item) => ({
            ...item,
            total: item.total.toString()
        }))

        return NextResponse.json({
            data,
            pagination: {
                total: result.total,
                limit,
                offset,
                hasMore: offset + limit < result.total
            }
        })
    } catch (error: any) {
        console.error('Error fetching outstanding invoices:', error)
        return NextResponse.json(
            { error: 'Failed to fetch outstanding invoices', details: error.message },
            { status: 500 }
        )
    }
}
