import { NextRequest } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { SiteService } from '@/modules/roles/services/SiteService'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

const siteService = new SiteService()

/**
 * GET /api/admin/sites - List all sites
 * Refactored to use SiteService (thin controller pattern)
 */
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!(await hasPermission('site:read'))) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat site')
        }

        const { searchParams } = new URL(request.url)
        const search = searchParams.get('search') || undefined
        const activeOnly = searchParams.get('activeOnly') === 'true'

        const sites = await siteService.getSites({ 
            ...(search ? { search } : {}), 
            activeOnly 
        })

        return apiSuccess(sites)
    } catch (error) {
        console.error('Error fetching sites:', error)
        return ApiErrors.internalError('Gagal mengambil daftar site')
    }
}

/**
 * POST /api/admin/sites - Create new site
 * Refactored to use SiteService (thin controller pattern)
 */
export async function POST(request: NextRequest) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!(await hasPermission('site:create'))) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk membuat site')
        }

        const body = await request.json()

        const site = await siteService.createSite(body, user.id)

        return apiSuccess(site, { status: 201, message: 'Site berhasil dibuat' })
    } catch (error: any) {
        console.error('Error creating site:', error)
        
        if (error.message === 'Code and name are required') {
            return apiError('Kode dan nama wajib diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }
        if (error.message === 'Site code already exists') {
            return ApiErrors.conflict('Kode site sudah ada')
        }
        
        return ApiErrors.internalError('Gagal membuat site')
    }
}
