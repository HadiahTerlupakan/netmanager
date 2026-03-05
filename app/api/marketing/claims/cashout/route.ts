import { NextRequest } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

// POST - Karyawan Cashout Target Accumulation
export async function POST(req: NextRequest) {
    try {
        const session = await verifyAuth(req)
        if (!session) return ApiErrors.unauthorized('Tidak terautentikasi')

        const userId = session.id

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { isSales: true, canvasingTarget: true, targetSchema: true }
        })

        if (!user) {
            return ApiErrors.notFound('User tidak ditemukan')
        }

        if (!user.isSales) {
            return ApiErrors.forbidden('Hanya akun sales yang dapat mencairkan bonus canvasing.')
        }

        if (user.targetSchema !== 'ACCUMULATED') {
            return ApiErrors.badRequest('Akun Anda menggunakan skema Target Bulanan. Pencairan dilakukan otomatis di akhir bulan.')
        }

        const target = user.canvasingTarget || 30

        // Get all approved but not cashed out claims
        const unclaimedClaims = await prisma.pointClaim.findMany({
            where: {
                salesId: userId,
                status: 'APPROVED',
                isCashedOut: false
            },
            select: { id: true }
        })

        if (unclaimedClaims.length < target) {
            return ApiErrors.badRequest(`Belum mencapai target minimal pencairan (${target} canvasing). Poin saat ini: ${unclaimedClaims.length}.`)
        }

        // Cash out all accumulated points
        const claimIds = unclaimedClaims.map(c => c.id)

        await prisma.pointClaim.updateMany({
            where: {
                id: { in: claimIds }
            },
            data: {
                isCashedOut: true
            }
        })

        return apiSuccess(
            { cashedOutCount: claimIds.length },
            { status: 200, message: `Berhasil mencairkan ${claimIds.length} poin canvasing.` }
        )
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Gagal mencairkan bonus canvasing'
        return ApiErrors.internalError(message)
    }
}
