import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { getAppVersionService } from '@/modules/app-version'

// Route segment config for large file uploads (APK)
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300  // 5 minutes for large APK uploads

// GET /api/admin/app-version - List all app versions
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Permission check
        if (!await hasPermission('app_version:read')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '10')
        const platform = searchParams.get('platform') || undefined
        const isActive = searchParams.get('isActive') === 'true' ? true : 
                         searchParams.get('isActive') === 'false' ? false : undefined

        const service = getAppVersionService()
        const result = await service.getAllVersions({ page, limit, platform, isActive })

        return NextResponse.json({
            success: true,
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
        return NextResponse.json({ error: error.message || 'Failed to fetch app versions' }, { status: 500 })
    }
}

// POST /api/admin/app-version - Upload new app version
export async function POST(request: NextRequest) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Permission check
        if (!await hasPermission('app_version:create')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
            return NextResponse.json(
                { error: 'Upload APK untuk auto-detect versi, atau isi manual version, buildNumber, dan versionCode' },
                { status: 400 }
            )
        }

        let apkBuffer: Buffer | undefined
        let apkFilename: string | undefined
        let apkSize: number | undefined
        let apkTempPath: string | undefined

        if (apkFile) {
            // For large files, save to temp file instead of loading into memory
            // This prevents memory issues with APK files > 100MB
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
            version: version || undefined,
            buildNumber,
            versionCode,
            platform,
            releaseNotes,
            isForceUpdate,
            minVersion,
            apkBuffer,
            apkPath: apkTempPath,  // Use temp file path for large files
            apkFilename,
            apkSize,
            createdBy: user.id
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

        return NextResponse.json({
            success: true,
            data: appVersion,
            message: 'Versi aplikasi berhasil diupload'
        }, { status: 201 })
    } catch (error: any) {
        console.error('[API] Error uploading app version:', error)
        
        // Ensure we always return JSON, even on error
        const errorMessage = error?.message || 'Failed to upload app version'
        const errorDetails: any = { error: errorMessage }
        
        // Include stack trace in development for debugging
        if (process.env.NODE_ENV === 'development' && error?.stack) {
            errorDetails.stack = error.stack
        }
        
        return NextResponse.json(errorDetails, { status: 500 })
    }
}
