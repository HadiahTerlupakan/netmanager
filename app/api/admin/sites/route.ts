import { hasPermission } from '@/lib/rbac'
import { SiteService } from '@/modules/roles'
import { apiSuccess, ApiErrors, ErrorCodes, apiError, createHandler } from '@/lib/api'

const siteService = new SiteService()

/**
 * GET /api/admin/sites - List all sites
 */
export const GET = createHandler({ auth: true }, async (req, _ctx) => {
    const { searchParams } = req.nextUrl
    const search = searchParams.get('search') || undefined
    const activeOnly = searchParams.get('activeOnly') === 'true'

    // Permission check
    // If requesting activeOnly (usually for dropdowns), allow any authenticated user
    // Otherwise (full management list), require site:read
    if (!activeOnly && !(await hasPermission('site:read'))) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat site (Butuh: site:read)')
    }

    const sites = await siteService.getSites({
        ...(search ? { search } : {}),
        activeOnly
    })

    return apiSuccess(sites)
})

/**
 * POST /api/admin/sites - Create new site
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('site:create')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk membuat site')
    }

    const body = await req.json()

    try {
        const site = await siteService.createSite(body, ctx.session!.user.id)
        return apiSuccess(site, { status: 201, message: 'Site berhasil dibuat' })
    } catch (error) {
        console.error('Error creating site:', error)

        const message = error instanceof Error ? error.message : ''
        if (message === 'Code and name are required') {
            return apiError('Kode dan nama wajib diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }
        if (message === 'Site code already exists') {
            return ApiErrors.conflict('Kode site sudah ada')
        }

        return ApiErrors.internalError('Gagal membuat site')
    }
})
