import { NextRequest } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { getAppVersionService } from '@/modules/app-version'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

interface RouteParams {
    params: Promise<{ id: string }>
}

// GET /api/admin/app-version/[id] - Get version detail
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!await hasPermission('app_version:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat versi aplikasi')
        }

        const { id } = await params
        const service = getAppVersionService()
        const version = await service.getVersionById(id)

        if (!version) {
            return ApiErrors.notFound('Versi aplikasi')
        }

        return apiSuccess(version)
    } catch (error: unknown) {
        console.error('Error fetching app version:', error)
        const errorMessage = error instanceof Error ? error.message : 'Gagal mengambil versi aplikasi'
        return ApiErrors.internalError(errorMessage)
    }
}

// PUT /api/admin/app-version/[id] - Update version info
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!await hasPermission('app_version:update')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah versi aplikasi')
        }

        const { id } = await params
        const body = await request.json()

        const service = getAppVersionService()
        const version = await service.updateVersion(id, {
            releaseNotes: body.releaseNotes,
            isForceUpdate: body.isForceUpdate,
            isActive: body.isActive,
            minVersion: body.minVersion
        })

        // System Log
        try {
            const { logger } = await import('@/lib/logger')
            await logger.logActivity({
                action: 'UPDATE',
                subject: 'AppVersion',
                userId: user.id,
                details: { id: version.id, version: version.version }
            })
        } catch (e) {
            console.error('Logging failed', e)
        }

        return apiSuccess(version, { message: 'Versi berhasil diperbarui' })
    } catch (error: unknown) {
        console.error('Error updating app version:', error)
        const errorMessage = error instanceof Error ? error.message : 'Gagal memperbarui versi aplikasi'
        return ApiErrors.internalError(errorMessage)
    }
}

// DELETE /api/admin/app-version/[id] - Hard delete version and file
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!await hasPermission('app_version:delete')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus versi aplikasi')
        }

        const { id } = await params
        const service = getAppVersionService()
        await service.deleteVersion(id)

        // System Log
        try {
            const { logger } = await import('@/lib/logger')
            await logger.logActivity({
                action: 'DELETE',
                subject: 'AppVersion',
                userId: user.id,
                details: { id }
            })
        } catch (e) {
            console.error('Logging failed', e)
        }

        return apiSuccess(null, { message: 'Versi dan file berhasil dihapus permanen' })
    } catch (error: unknown) {
        console.error('Error deleting app version:', error)
        const errorMessage = error instanceof Error ? error.message : 'Gagal menghapus versi aplikasi'
        return ApiErrors.internalError(errorMessage)
    }
}
