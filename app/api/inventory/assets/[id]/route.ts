import { NextRequest, NextResponse } from 'next/server'
import { AssetService } from '@/modules/inventory/services/AssetService'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z, ZodError } from 'zod'
import { AssetStatus } from '@prisma/client'

const assetService = new AssetService()

// Validation schema for updates
const updateAssetSchema = z.object({
    kodeAsset: z.string().optional(),
    status: z.nativeEnum(AssetStatus).optional(),
    location: z.string().optional(),
    assignedTo: z.string().optional()
})

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { id } = await params
        const asset = await assetService.getAsset(id)
        if (!asset) {
            return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
        }

        return NextResponse.json({ asset })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await req.json()
        const validated = updateAssetSchema.parse(body)

        const { id } = await params
        const updated = await assetService.updateAsset(id, validated)

        return NextResponse.json({ asset: updated })
    } catch (error: any) {
        if (error instanceof ZodError) {
            return NextResponse.json({ error: (error as any).errors || error.issues }, { status: 400 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
