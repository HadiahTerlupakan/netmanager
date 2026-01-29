import { NextRequest } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { getAppVersionService } from '@/modules/app-version'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

// Route segment config for large file uploads (APK)
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300  // 5 minutes for large APK uploads

// GET /api/admin/app-version - List all app versions
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        // Permission check
        if (!await hasPermission('app_version:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat versi aplikasi')
        }

        const { searchParams } = new URL(request.url)
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

        return apiSuccess({
            data: result.data,
            pagination: {
                page: result.page,
                limit: result.limit,
                total: result.total,
                totalPages: Math.ceil(result.total / result.limit)
            }
        })
    } catch (error: any) {
        console.error('Error fetching app versions:', error)
        return ApiErrors.internalError(error.message || 'Gagal mengambil daftar versi aplikasi')
    }
}

// POST /api/admin/app-version - Upload new app version
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

        const formData = await request.formData()
        
        // Semua field optional karena bisa auto-extract dari APK
        const version = formData.get('version') as string | null
        const buildNumberStr = formData.get('buildNumber') as string | null
        const versionCodeStr = formData.get('versionCode') as string | null
        const platform = (formData.get('platform') as string) || 'android'
        const releaseNotes = formData.get('releaseNotes') as string || undefined
        const isForceUpdate = formData.get('isForceUpdate') === 'true'
        const minVersion = formData.get('minVersion') as string || undefined
        const apkFile = formData.get('apk') as File | null

        const buildNumber = buildNumberStr ? parseInt(buildNumberStr) : undefined
        const versionCode = versionCodeStr ? parseInt(versionCodeStr) : undefined

        // Validation - butuh APK atau field lengkap
        if (!apkFile && (!version || !buildNumber || !versionCode)) {
            return apiError(
                'Upload APK untuk auto-detect versi, atau isi manual version, buildNumber, dan versionCode',
                ErrorCodes.VALIDATION_ERROR,
                { status: 400 }
            )
        }

        let apkBuffer: Buffer | undefined
        let apkFilename: string | undefined
        let apkSize: number | undefined
        let apkTempPath: string | undefined

        if (apkFile) {
            // For large files, save to temp file instead of loading into memory
            const fs = await import('fs/promises')
            const path = await import('path')
            const os = await import('os')
            
            apkTempPath = path.join(os.tmpdir(), `apk_upload_${Date.now()}_${apkFile.name}`)
            const arrayBuffer = await apkFile.arrayBuffer()
            await fs.writeFile(apkTempPath, Buffer.from(arrayBuffer))
            
            apkFilename = apkFile.name
            apkSize = apkFile.size
            console.log(`[APK Upload] Saved temp file: ${apkTempPath} (${(apkSize / 1024 / 1024).toFixed(1)}MB)`)
        }

        const service = getAppVersionService()
        const appVersion = await service.uploadVersion({
            platform,
            isForceUpdate,
            createdBy: user.id,
            ...(version ? { version } : {}),
            ...(buildNumber ? { buildNumber } : {}),
            ...(versionCode ? { versionCode } : {}),
            ...(releaseNotes ? { releaseNotes } : {}),
            ...(minVersion ? { minVersion } : {}),
            ...(apkBuffer ? { apkBuffer } : {}),
            ...(apkTempPath ? { apkPath: apkTempPath } : {}),
            ...(apkFilename ? { apkFilename } : {}),
            ...(apkSize ? { apkSize } : {})
        })

        // Cleanup temp file after successful upload
        if (apkTempPath) {
            try {
                const fs = await import('fs/promises')
                await fs.unlink(apkTempPath)
                console.log(`[APK Upload] Cleaned up temp file: ${apkTempPath}`)
            } catch (e) {
                console.warn(`[APK Upload] Failed to cleanup temp file: ${apkTempPath}`, e)
            }
        }

        // System Log
        try {
            const { logger } = await import('@/lib/logger')
            await logger.logActivity({
                action: 'CREATE',
                subject: 'AppVersion',
                userId: user.id,
                details: { id: appVersion.id, version: appVersion.version }
            })
        } catch (e) {
            console.error('Logging failed', e)
        }

        return apiSuccess(appVersion, { status: 201, message: 'Versi aplikasi berhasil diupload' })
    } catch (error: any) {
        console.error('[API] Error uploading app version:', error)
        return ApiErrors.internalError(error?.message || 'Gagal upload versi aplikasi')
    }
}
