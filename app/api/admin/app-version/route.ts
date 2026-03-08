import { hasPermission } from '@/lib/rbac'
import { deleteFromR2 } from '@/lib/utils/r2-client'
import { getAppVersionService } from '@/modules/app-version'
import { apiSuccess, ApiErrors, ErrorCodes, apiError, apiPaginated, createHandler } from '@/lib/api'
import { logActivitySafe } from '@/lib/logger'

function parsePositiveInteger(value: string | null, fieldName: string): number | undefined {
    if (!value || !value.trim()) {
        return undefined
    }

    const normalized = value.trim()
    if (!/^\d+$/.test(normalized)) {
        throw new Error(`${fieldName} harus berupa angka bulat positif`)
    }

    const parsed = Number(normalized)
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`${fieldName} harus berupa angka bulat positif`)
    }

    return parsed
}

// Route segment config for large file uploads (APK)
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300  // 5 minutes for large APK uploads

// GET /api/admin/app-version - List all app versions
export const GET = createHandler({ auth: true }, async (req, _ctx) => {
    if (!await hasPermission('app_version:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat versi aplikasi')
    }

    const { searchParams } = req.nextUrl
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const platform = searchParams.get('platform') || undefined
    const isActive = searchParams.get('isActive') === 'true' ? true :
        searchParams.get('isActive') === 'false' ? false : undefined

    const service = getAppVersionService()
    const result = await service.getAllVersions({
        page,
        limit,
        ...(platform ? { platform } : {}),
        ...(isActive !== undefined ? { isActive } : {})
    })

    return apiPaginated(result.data, {
        page: result.page,
        limit: result.limit,
        total: result.total
    })
})

// POST /api/admin/app-version - Upload new app version
export const POST = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('app_version:create')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk upload versi aplikasi')
    }

    const formData = await req.formData()

    // Semua field optional karena bisa auto-extract dari APK
    const version = formData.get('version') as string | null
    const buildNumberStr = formData.get('buildNumber') as string | null
    const versionCodeStr = formData.get('versionCode') as string | null
    const platform = (formData.get('platform') as string) || 'android'
    const releaseNotes = formData.get('releaseNotes') as string || undefined
    const isForceUpdate = formData.get('isForceUpdate') === 'true'
    const minVersion = formData.get('minVersion') as string || undefined
    const apkFile = formData.get('apk') as File | null

    // New fields for direct upload
    const uploadedKey = formData.get('uploadedKey') as string | null
    const uploadedFilename = formData.get('uploadedFilename') as string | null
    const uploadedSizeStr = formData.get('uploadedSize') as string | null
    let uploadedSize: number | undefined
    const forceLocal = formData.get('forceLocal') === 'true'

    let buildNumber: number | undefined
    let versionCode: number | undefined

    try {
        buildNumber = parsePositiveInteger(buildNumberStr, 'buildNumber')
        versionCode = parsePositiveInteger(versionCodeStr, 'versionCode')
        uploadedSize = parsePositiveInteger(uploadedSizeStr, 'uploadedSize')
    } catch (error) {
        return apiError(
            error instanceof Error ? error.message : 'Input numerik tidak valid',
            ErrorCodes.VALIDATION_ERROR,
            { status: 400 }
        )
    }

    // Validation - butuh APK (file/key) atau field lengkap
    const hasApk = apkFile || uploadedKey
    if (!hasApk && (!version || !buildNumber || !versionCode)) {
        return apiError(
            'Upload APK untuk auto-detect versi, atau isi manual version, buildNumber, dan versionCode',
            ErrorCodes.VALIDATION_ERROR,
            { status: 400 }
        )
    }

    if (apkFile && !apkFile.name.toLowerCase().endsWith('.apk')) {
        return apiError('File yang diupload harus berformat APK', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    if (uploadedFilename && !uploadedFilename.toLowerCase().endsWith('.apk')) {
        return apiError('File direct upload harus berformat APK', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    let apkBuffer: Buffer | undefined
    let apkFilename: string | undefined
    let apkSize: number | undefined
    let apkTempPath: string | undefined

    // Handle Legacy Upload (APK File sent to server)
    if (apkFile) {
        // For large files, save to temp file instead of loading into memory
        const fs = await import('fs/promises')
        const path = await import('path')
        const os = await import('os')
        const { randomUUID } = await import('crypto')

        const fileExtension = path.extname(apkFile.name)
        apkTempPath = path.join(os.tmpdir(), `apk_upload_${randomUUID()}${fileExtension}`)
        const arrayBuffer = await apkFile.arrayBuffer()
        await fs.writeFile(apkTempPath, Buffer.from(arrayBuffer))

        apkFilename = apkFile.name
        apkSize = apkFile.size
    }

    const service = getAppVersionService()
    let appVersion: Awaited<ReturnType<typeof service.uploadVersion>> | null = null

    try {
        appVersion = await service.uploadVersion({
            platform,
            isForceUpdate,
            createdBy: ctx.session!.user.id,
            ...(version ? { version } : {}),
            ...(buildNumber ? { buildNumber } : {}),
            ...(versionCode ? { versionCode } : {}),
            ...(releaseNotes ? { releaseNotes } : {}),
            ...(minVersion ? { minVersion } : {}),
            ...(apkBuffer ? { apkBuffer } : {}),
            ...(apkTempPath ? { apkPath: apkTempPath } : {}),
            ...(apkFilename ? { apkFilename } : {}),
            ...(apkSize ? { apkSize } : {}),
            ...(uploadedKey ? { uploadedKey } : {}),
            ...(uploadedFilename ? { uploadedFilename } : {}),
            ...(uploadedSize ? { uploadedSize } : {}),
            forceLocal,
        })
    } catch (error) {
        if (uploadedKey) {
            await deleteFromR2(uploadedKey)
        }
        throw error
    } finally {
        if (apkTempPath) {
            try {
                const fs = await import('fs/promises')
                await fs.unlink(apkTempPath)
            } catch (e) {
                console.warn(`[APK Upload] Failed to cleanup temp file: ${apkTempPath}`, e)
            }
        }
    }

    // System Log
    logActivitySafe({
        action: 'CREATE',
        subject: 'AppVersion',
        userId: ctx.session!.user.id,
        details: { id: appVersion.id, version: appVersion.version }
    })

    return apiSuccess(appVersion, { status: 201, message: 'Versi aplikasi berhasil diupload' })
})
