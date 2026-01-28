import { NextRequest } from 'next/server'
import { AssetService } from '@/modules/inventory/services/AssetService'
import { z, ZodError } from 'zod'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

const assetService = new AssetService()

import { AssetStatus } from '@prisma/client'

// Schema for creating asset
const createAssetSchema = z.object({
    barangId: z.string().min(1, 'Barang is required'),
    kodeAsset: z.string().min(1, 'Kode Asset is required'),
    purchaseDate: z.string().or(z.date()).transform(val => new Date(val)),
    purchasePrice: z.number().min(0),
    usefulLife: z.number().int().min(1),
    residualValue: z.number().min(0).optional().default(0),
    status: z.nativeEnum(AssetStatus).optional(),
    location: z.string().optional(),
    assignedTo: z.string().optional()
})


export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || !session.user?.id) {
            return ApiErrors.unauthorized('Session tidak valid')
        }
        
        const { searchParams } = new URL(req.url)
        const page = Number(searchParams.get('page')) || 1
        const limit = Number(searchParams.get('limit')) || 10
        const search = searchParams.get('search') || undefined
        const status = searchParams.get('status') ? searchParams.get('status') as AssetStatus : undefined
        
        const result = await assetService.findAllAssets({
            page,
            limit,
            search,
            status
        })

        return apiSuccess({
            assets: result.items,
            total: result.total,
            page,
            limit
        })
    } catch (error: any) {
        console.error('Failed to fetch assets:', error)
        return ApiErrors.internalError(error.message || 'Gagal memuat data aset')
    }
}


export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || !session.user?.id) {
            return ApiErrors.unauthorized('Session tidak valid')
        }
        
        // TODO: Check permission (inventory:create)

        const body = await req.json()
        const validated = createAssetSchema.parse(body)

        const asset = await assetService.createAsset(validated, session.user.id)

        return apiSuccess({ asset }, { status: 201, message: 'Aset berhasil dibuat' })
    } catch (error: any) {
        console.error('Failed to create asset:', error)
        if (error instanceof ZodError) {
            return apiError('Validasi gagal', ErrorCodes.VALIDATION_ERROR, { 
                status: 400, 
                details: { errors: error.issues } 
            })
        }
        return ApiErrors.internalError(error.message || 'Gagal membuat aset')
    }
}
