import { NextRequest, NextResponse } from 'next/server'
import { AssetService } from '@/modules/inventory'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const assetService = new AssetService()

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || !session.user?.id) return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })

        const { id } = await params
        // Optional: Custom date
        const body = await req.json().catch(() => ({}))
        const date = body.date ? new Date(body.date) : new Date()

        const result = await assetService.depreciateAsset(id, date, session.user.id)
        
        if (!result) {
            return NextResponse.json({ message: 'Tidak ada penyusutan yang diterapkan (Aset sudah mencapai nilai residu atau tidak aktif)' })
        }

        return NextResponse.json({ log: result })
    } catch (error) {
        const err = error as Error
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
