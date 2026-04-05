import { hasPermission } from '@/lib/rbac'
import { HargaPaketService } from '@/modules/network'
import { apiSuccess, ApiErrors, ErrorCodes, apiError, createHandler } from '@/lib/api'

const hargaPaketService = new HargaPaketService()

export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const { id } = ctx.params
    try {
        const hargaPaket = await hargaPaketService.getHargaPaketById(id)
        return apiSuccess(hargaPaket)
    } catch (error: unknown) {
        const err = error as Error;
        console.error('[HargaPaket GET Error]:', err)

        if (err.message === 'Harga paket tidak ditemukan') {
            return ApiErrors.notFound('Harga paket')
        }

        return ApiErrors.internalError(err?.message || 'Gagal mengambil data harga paket')
    }
})

export const PUT = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('harga:update')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk memperbarui harga paket')
    }

    const { id } = ctx.params
    const body = await req.json()
    const user = ctx.session!.user

    if (user.tenantId) {
        body.tenantId = user.tenantId
    }

    try {
        const updated = await hargaPaketService.updateHargaPaket(id, body, ctx.session!.user.id)
        return apiSuccess(updated, { message: 'Harga paket berhasil diperbarui' })
    } catch (error: unknown) {
        const err = error as Error & { code?: string };
        console.error('[HargaPaket PUT Error]:', err)

        if (err.message === 'Harga paket tidak ditemukan' || err.code === 'P2025') {
            return ApiErrors.notFound('Harga paket')
        }
        if (err.code === 'P2002') {
            return apiError('Nama paket sudah digunakan', ErrorCodes.CONFLICT, { status: 409 })
        }
        if (err.code === 'P2003') {
            return apiError('Bandwidth atau Profile PPP tidak ditemukan', ErrorCodes.NOT_FOUND, { status: 404 })
        }

        return ApiErrors.internalError(err?.message || 'Gagal memperbarui harga paket')
    }
})

export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('harga:delete')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus harga paket')
    }

    const { id } = ctx.params

    try {
        await hargaPaketService.deleteHargaPaket(id, ctx.session!.user.id)
        return apiSuccess(null, { message: 'Harga paket berhasil dihapus' })
    } catch (error: unknown) {
        const err = error as Error & { code?: string };
        console.error('[HargaPaket DELETE Error]:', err)

        if (err.message === 'Harga paket tidak ditemukan' || err.code === 'P2025') {
            return ApiErrors.notFound('Harga paket')
        }
        if (err.message.includes('tidak dapat dihapus') || err.message.includes('masih digunakan')) {
            return apiError(err.message, ErrorCodes.CONFLICT, { status: 409 })
        }

        return ApiErrors.internalError(err?.message || 'Gagal menghapus harga paket')
    }
})
