import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { HargaPaketService } from '@/modules/network/services/HargaPaketService'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

const hargaPaketService = new HargaPaketService()

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!(await hasPermission('harga:read'))) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat harga paket')
        }

        const { searchParams } = new URL(req.url)
        const status = searchParams.get('status') || undefined
        const featured = searchParams.get('featured')
        const siteIdParam = searchParams.get('siteId')

        const options: Record<string, unknown> = {}
        if (status) options.status = status
        if (featured !== null) options.featured = featured === 'true'

        const isSiteRestricted = (await hasPermission('harga:site_only')) && session.user.role !== 'SUPER_ADMIN'
        const userSiteId = (session.user as { siteId?: string }).siteId

        if (isSiteRestricted) {
            if (!userSiteId) return apiSuccess([])
            options.siteId = userSiteId
        } else if (siteIdParam) {
            options.siteId = siteIdParam
        }

        const hargaPakets = await hargaPaketService.getAllHargaPakets(options)
        return apiSuccess(hargaPakets)
    } catch (error: unknown) {
        const err = error as Error;
        console.error('[HargaPaket GET Error]:', err)
        return ApiErrors.internalError(err?.message || 'Gagal mengambil data harga paket')
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!(await hasPermission('harga:create'))) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk membuat harga paket')
        }

        const body = await req.json()

        const isSiteRestricted = (await hasPermission('harga:site_only')) && session.user.role !== 'SUPER_ADMIN'
        const userSiteId = (session.user as { siteId?: string }).siteId

        if (isSiteRestricted) {
            if (!userSiteId) {
                return ApiErrors.forbidden('User tidak memiliki akses site')
            }
            body.siteId = userSiteId
        }

        const hargaPaket = await hargaPaketService.createHargaPaket(body, session.user.id)
        return apiSuccess(hargaPaket, { status: 201, message: 'Harga paket berhasil dibuat' })
    } catch (error: unknown) {
        const err = error as Error & { code?: string; details?: unknown };
        console.error('[HargaPaket POST Error]:', err)

        if (err.code === 'VALIDATION_ERROR') {
            return apiError(err.message, ErrorCodes.VALIDATION_ERROR, {
                status: 400,
                details: err.details as Record<string, unknown>
            })
        }

        if (err.code === 'P2002') {
            return apiError('Nama paket sudah digunakan', ErrorCodes.CONFLICT, { status: 409 })
        }

        if (err.code === 'P2003') {
            return apiError('Bandwidth atau Profile PPP tidak ditemukan', ErrorCodes.NOT_FOUND, { status: 404 })
        }

        return ApiErrors.internalError(err?.message || 'Gagal membuat harga paket')
    }
}
