import { NextRequest } from 'next/server'
import { AssetService } from '@/modules/inventory/services/AssetService'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z, ZodError } from 'zod'
import { AssetStatus } from '@prisma/client'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

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
        if (!session) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        const { id } = await params
        const asset = await assetService.getAsset(id)
        if (!asset) {
            return ApiErrors.notFound('Asset')
        }

        return apiSuccess({ asset })
    } catch (error: any) {
        return ApiErrors.internalError(error.message || 'Gagal memuat data aset')
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        const body = await req.json()
        const validated = updateAssetSchema.parse(body)

        const { id } = await params
        const updated = await assetService.updateAsset(id, validated)

        return apiSuccess({ asset: updated }, { message: 'Aset berhasil diperbarui' })
    } catch (error: any) {
        if (error instanceof ZodError) {
            return apiError('Validasi gagal', ErrorCodes.VALIDATION_ERROR, { 
                status: 400, 
                details: { errors: error.issues } 
            })
        }
        return ApiErrors.internalError(error.message || 'Gagal memperbarui aset')
    }
}
