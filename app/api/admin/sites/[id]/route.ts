import { hasPermission } from '@/lib/rbac'
import { SiteService } from '@/modules/roles/services/SiteService'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'

const siteService = new SiteService()

/**
 * GET /api/admin/sites/[id] - Get site details
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('site:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat site')
    }

    const { id } = ctx.params
    try {
        const site = await siteService.getSiteById(id)
        return apiSuccess(site)
    } catch (error) {
        console.error('Error fetching site:', error)

        const message = error instanceof Error ? error.message : ''
        if (message === 'Site not found' || message === 'Site tidak ditemukan') {
            return ApiErrors.notFound('Site')
        }

        return ApiErrors.internalError('Gagal mengambil data site')
    }
})

/**
 * PATCH /api/admin/sites/[id] - Update site
 */
export const PATCH = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('site:update')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah site')
    }

    const { id } = ctx.params
    const body = await req.json()

    try {
        const site = await siteService.updateSite(id, body, ctx.session!.user.id)
        return apiSuccess(site, { message: 'Site berhasil diperbarui' })
    } catch (error) {
        console.error('Error updating site:', error)

        const message = error instanceof Error ? error.message : ''
        if (message === 'Site not found' || message === 'Site tidak ditemukan') {
            return ApiErrors.notFound('Site')
        }
        if (message === 'Site code already exists') {
            return ApiErrors.conflict('Kode site sudah ada')
        }

        return ApiErrors.internalError('Gagal memperbarui site')
    }
})

/**
 * DELETE /api/admin/sites/[id] - Delete site
 */
export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('site:delete')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus site')
    }

    const { id } = ctx.params
    try {
        const result = await siteService.deleteSite(id, ctx.session!.user.id)
        return apiSuccess(null, { message: result.message })
    } catch (error) {
        console.error('Error deleting site:', error)

        const message = error instanceof Error ? error.message : ''
        if (message === 'Site not found' || message === 'Site tidak ditemukan') {
            return ApiErrors.notFound('Site')
        }

        return ApiErrors.internalError('Gagal menghapus site')
    }
})
