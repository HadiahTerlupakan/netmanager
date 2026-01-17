import { NextRequest, NextResponse } from 'next/server'
import { AssetService } from '@/modules/inventory/services/AssetService'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'

const assetService = new AssetService()

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || !session.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { id } = await params
        // Optional: Custom date
        const body = await req.json().catch(() => ({}))
        const date = body.date ? new Date(body.date) : new Date()

        const result = await assetService.depreciateAsset(id, date, session.user.id)
        
        if (!result) {
            return NextResponse.json({ message: 'No depreciation applied (Asset already at residual value or inactive)' })
        }

        return NextResponse.json({ log: result })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
