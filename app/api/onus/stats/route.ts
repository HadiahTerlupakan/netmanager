
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { getOnuRepository } from '@/lib/repositories'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    try {
        const user = await verifyAuth(req)
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const oltId = searchParams.get('oltId') || undefined

        const onuRepo = getOnuRepository()
        const stats = await onuRepo.getSummaryStats(oltId)

        return NextResponse.json(stats)
    } catch (error: any) {
        console.error('Error fetching ONU stats:', error)
        return NextResponse.json(
            { error: error?.message || 'Internal Server Error' },
            { status: 500 }
        )
    }
}
