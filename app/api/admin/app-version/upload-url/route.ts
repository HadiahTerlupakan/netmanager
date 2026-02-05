import { NextRequest } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { getPresignedUrl, generateR2Key } from '@/lib/utils/r2-client'
import { apiSuccess, ApiErrors, apiError, ErrorCodes } from '@/lib/api-response'

export async function POST(request: NextRequest) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        // Permission check
        if (!await hasPermission('app_version:create')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk upload versi aplikasi')
        }

        const body = await request.json()
        const { filename, contentType, size } = body

        if (!filename || !contentType) {
            return apiError('Filename dan content type harus diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }

        // Validate size if needed (e.g. limit to 500MB)
        const MAX_SIZE = 500 * 1024 * 1024 // 500MB
        if (size && size > MAX_SIZE) {
            return apiError('Ukuran file melebihi batas 500MB', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }

        // Generate key
        const key = generateR2Key('app-version', filename)

        // Get presigned URL
        const { uploadUrl, publicUrl } = await getPresignedUrl(key, contentType)

        return apiSuccess({
            uploadUrl,
            publicUrl,
            key,
            filename
        })
    } catch (error: unknown) {
        console.error('[API] Error generating upload URL:', error)
        const errorMessage = error instanceof Error ? error.message : 'Gagal membuat URL upload'
        return ApiErrors.internalError(errorMessage)
    }
}
