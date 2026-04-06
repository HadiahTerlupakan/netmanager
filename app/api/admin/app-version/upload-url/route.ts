import { hasPermission } from '@/lib/rbac'
import { getAppVersionService } from '@/modules/app-version'
import { apiSuccess, ApiErrors, apiError, ErrorCodes, createHandler } from '@/lib/api'

export const POST = createHandler({ auth: true }, async (req, _ctx) => {
    if (!await hasPermission('app_version:create')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk upload versi aplikasi')
    }

    const body = await req.json()
    const { filename, contentType, size } = body

    if (!filename || !contentType) {
        return apiError('Filename dan content type harus diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    if (!filename.toLowerCase().endsWith('.apk')) {
        return apiError('File yang diupload harus berformat APK', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    const allowedContentTypes = new Set([
        'application/vnd.android.package-archive',
        'application/octet-stream'
    ])

    if (!allowedContentTypes.has(contentType)) {
        return apiError('Content type file APK tidak valid', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    // Validate size if needed (e.g. limit to 500MB)
    const MAX_SIZE = 500 * 1024 * 1024 // 500MB
    if (size && size > MAX_SIZE) {
        return apiError('Ukuran file melebihi batas 500MB', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    const service = getAppVersionService()
    const { uploadUrl, publicUrl, key } = await service.createDirectUploadUrl({ filename, contentType })

    return apiSuccess({
        uploadUrl,
        publicUrl,
        key,
        filename
    })
})
