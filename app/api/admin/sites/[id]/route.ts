import { NextRequest } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { SiteService } from '@/modules/roles/services/SiteService'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

const siteService = new SiteService()

/**
 * GET /api/admin/sites/[id] - Get site details
 * Refactored to use SiteService (thin controller pattern)
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!(await hasPermission('site:read'))) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat site')
        }

        const { id } = await params
        const site = await siteService.getSiteById(id)

        return apiSuccess(site)
    } catch (error: any) {
        console.error('Error fetching site:', error)
        
        if (error.message === 'Site not found') {
            return ApiErrors.notFound('Site')
        }
        
        return ApiErrors.internalError('Gagal mengambil data site')
    }
}

/**
 * PATCH /api/admin/sites/[id] - Update site
 * Refactored to use SiteService (thin controller pattern)
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!(await hasPermission('site:update'))) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah site')
        }

        const { id } = await params
        const body = await request.json()

        const site = await siteService.updateSite(id, body, user.id)

        return apiSuccess(site, { message: 'Site berhasil diperbarui' })
    } catch (error: any) {
        console.error('Error updating site:', error)
        
        if (error.message === 'Site not found') {
            return ApiErrors.notFound('Site')
        }
        if (error.message === 'Site code already exists') {
            return ApiErrors.conflict('Kode site sudah ada')
        }
        
        return ApiErrors.internalError('Gagal memperbarui site')
    }
}

/**
 * DELETE /api/admin/sites/[id] - Delete site
 * Refactored to use SiteService (thin controller pattern)
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!(await hasPermission('site:delete'))) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus site')
        }

        const { id } = await params
        const result = await siteService.deleteSite(id, user.id)

        return apiSuccess(null, { message: result.message })
    } catch (error: any) {
        console.error('Error deleting site:', error)
        
        if (error.message === 'Site not found') {
            return ApiErrors.notFound('Site')
        }
        
        return ApiErrors.internalError('Gagal menghapus site')
    }
}
