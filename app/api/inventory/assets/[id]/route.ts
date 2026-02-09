import { NextRequest } from 'next/server'
import { AssetService } from '@/modules/inventory/services/AssetService'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
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

        // Permission check
        if (!(await hasPermission('asset:read'))) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat data aset')
        }

        const { id } = await params
        const asset = await assetService.getAsset(id)
        if (!asset) {
            return ApiErrors.notFound('Asset')
        }

        return apiSuccess({ asset })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Gagal memuat data aset'
        return ApiErrors.internalError(message)
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

        // Permission check
        if (!(await hasPermission('asset:update'))) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah data aset')
        }

        const body = await req.json()
        const { kodeAsset, status, location, assignedTo } = updateAssetSchema.parse(body)

        const { id } = await params
        const updated = await assetService.updateAsset(id, {
            ...(kodeAsset ? { kodeAsset } : {}),
            ...(status ? { status } : {}),
            ...(location ? { location } : {}),
            ...(assignedTo ? { assignedTo } : {})
        })

        return apiSuccess({ asset: updated }, { message: 'Aset berhasil diperbarui' })
    } catch (error: unknown) {
        if (error instanceof ZodError) {
            return apiError('Validasi gagal', ErrorCodes.VALIDATION_ERROR, { 
                status: 400, 
                details: { errors: error.issues } 
            })
        }
        const message = error instanceof Error ? error.message : 'Gagal memperbarui aset'
        return ApiErrors.internalError(message)
    }
}
