import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { hasPermission } from '@/lib/rbac'
import { HargaPaketService } from '@/modules/network/services/HargaPaketService'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

const hargaPaketService = new HargaPaketService()

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth(req)
        if (session instanceof Response) return ApiErrors.unauthorized('Session tidak valid')

        const { id } = await params
        const hargaPaket = await hargaPaketService.getHargaPaketById(id)
        return apiSuccess(hargaPaket)
    } catch (error: any) {
        console.error('[HargaPaket GET Error]:', error)
        
        if (error.message === 'Harga paket tidak ditemukan') {
            return ApiErrors.notFound('Harga paket')
        }
        
        return ApiErrors.internalError(error?.message || 'Gagal mengambil data harga paket')
    }
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth(req)
        if (session instanceof Response) return ApiErrors.unauthorized('Session tidak valid')
        
        if (!(await hasPermission('harga:update'))) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk memperbarui harga paket')
        }

        const { id } = await params
        const body = await req.json()

        const updated = await hargaPaketService.updateHargaPaket(id, body, (session as any).user?.id)
        return apiSuccess(updated, { message: 'Harga paket berhasil diperbarui' })
    } catch (error: any) {
        console.error('[HargaPaket PUT Error]:', error)

        if (error.message === 'Harga paket tidak ditemukan' || error.code === 'P2025') {
            return ApiErrors.notFound('Harga paket')
        }
        if (error.code === 'P2002') {
            return apiError('Nama paket sudah digunakan', ErrorCodes.CONFLICT, { status: 409 })
        }
        if (error.code === 'P2003') {
            return apiError('Bandwidth atau Profile PPP tidak ditemukan', ErrorCodes.NOT_FOUND, { status: 404 })
        }

        return ApiErrors.internalError(error?.message || 'Gagal memperbarui harga paket')
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth(req)
        if (session instanceof Response) return ApiErrors.unauthorized('Session tidak valid')

        if (!(await hasPermission('harga:delete'))) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus harga paket')
        }

        const { id } = await params
        await hargaPaketService.deleteHargaPaket(id, (session as any).user?.id)
        return apiSuccess(null, { message: 'Harga paket berhasil dihapus' })
    } catch (error: any) {
        console.error('[HargaPaket DELETE Error]:', error)

        if (error.message === 'Harga paket tidak ditemukan' || error.code === 'P2025') {
            return ApiErrors.notFound('Harga paket')
        }
        if (error.message.includes('tidak dapat dihapus') || error.message.includes('masih digunakan')) {
            return apiError(error.message, ErrorCodes.CONFLICT, { status: 409 })
        }

        return ApiErrors.internalError(error?.message || 'Gagal menghapus harga paket')
    }
}
