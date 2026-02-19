import { hasPermission } from '@/lib/rbac'
import { HargaPaketService } from '@/modules/network/services/HargaPaketService'
import { apiSuccess, ApiErrors, ErrorCodes, apiError, createHandler } from '@/lib/api'

const hargaPaketService = new HargaPaketService()

export const GET = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('harga:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat harga paket')
    }

    const { searchParams } = req.nextUrl
    const status = searchParams.get('status') || undefined
    const featured = searchParams.get('featured')
    const siteIdParam = searchParams.get('siteId')

    const options: Record<string, unknown> = {}
    if (status) options.status = status
    if (featured !== null) options.featured = featured === 'true'

    const user = ctx.session!.user
    const isSiteRestricted = (await hasPermission('harga:site_only')) && user.role !== 'SUPER_ADMIN'
    
    if (isSiteRestricted) {
        const { prisma: db } = await import('@/lib/prisma');
        const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { siteId: true } });
        const userSiteId = dbUser?.siteId

        if (!userSiteId) return apiSuccess([])
        options.siteId = userSiteId
    } else if (siteIdParam) {
        options.siteId = siteIdParam
    }

    const hargaPakets = await hargaPaketService.getAllHargaPakets(options)
    return apiSuccess(hargaPakets)
})

export const POST = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('harga:create')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk membuat harga paket')
    }

    const body = await req.json()
    const user = ctx.session!.user

    const isSiteRestricted = (await hasPermission('harga:site_only')) && user.role !== 'SUPER_ADMIN'
    
    if (isSiteRestricted) {
        const { prisma: db } = await import('@/lib/prisma');
        const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { siteId: true } });
        const userSiteId = dbUser?.siteId

        if (!userSiteId) {
            return ApiErrors.forbidden('User tidak memiliki akses site')
        }
        body.siteId = userSiteId
    }

    try {
        const hargaPaket = await hargaPaketService.createHargaPaket(body, user.id)
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
})
