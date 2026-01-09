import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { getAppVersionService } from '@/modules/app-version'

interface RouteParams {
    params: Promise<{ id: string }>
}

// GET /api/admin/app-version/[id] - Get version detail
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!await hasPermission('app_version:read')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { id } = await params
        const service = getAppVersionService()
        const version = await service.getVersionById(id)

        if (!version) {
            return NextResponse.json({ error: 'Versi tidak ditemukan' }, { status: 404 })
        }

        return NextResponse.json({ success: true, data: version })
    } catch (error: any) {
        console.error('Error fetching app version:', error)
        return NextResponse.json({ error: error.message || 'Failed to fetch app version' }, { status: 500 })
    }
}

// PUT /api/admin/app-version/[id] - Update version info
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!await hasPermission('app_version:update')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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

        return NextResponse.json({
            success: true,
            data: version,
            message: 'Versi berhasil diupdate'
        })
    } catch (error: any) {
        console.error('Error updating app version:', error)
        return NextResponse.json({ error: error.message || 'Failed to update app version' }, { status: 500 })
    }
}

// DELETE /api/admin/app-version/[id] - Hard delete version and file
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!await hasPermission('app_version:delete')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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

        return NextResponse.json({
            success: true,
            message: 'Versi dan file berhasil dihapus permanen'
        })
    } catch (error: any) {
        console.error('Error deleting app version:', error)
        return NextResponse.json({ error: error.message || 'Failed to delete app version' }, { status: 500 })
    }
}
