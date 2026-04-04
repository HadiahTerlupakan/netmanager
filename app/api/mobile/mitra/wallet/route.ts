import { NextRequest } from 'next/server'
import { getMobileAuthPayload } from '@/lib/mobile-api-auth'
import { apiSuccess, ApiErrors } from '@/lib/api-response'
import { getMitraWalletService } from '@/modules/mitra'
import { prismaMitra } from '@/modules/database'

const walletService = getMitraWalletService()

// GET /api/mobile/mitra/wallet — Get wallet balance + transactions
export async function GET(req: NextRequest) {
    try {
        const authResult = await getMobileAuthPayload(req)
        if (authResult instanceof Response) return authResult

        const session = authResult

        if (session.role !== 'MITRA') {
            return ApiErrors.forbidden('Bukan akun mitra');
        }

        const mitra = await prismaMitra.mitra.findUnique({
            where: { id: session.id },
            select: { id: true, mitraType: true, isActive: true },
        })

        if (!mitra) return ApiErrors.notFound('Mitra tidak ditemukan')
        if (!mitra.isActive) return ApiErrors.forbidden('Akun Mitra tidak aktif')

        const { searchParams } = new URL(req.url)
        const page = parseInt(searchParams.get('page') || '1')

        const [balanceResult, txResult] = await Promise.all([
            walletService.getBalance(mitra.id, session.tenantId as string),
            walletService.getTransactions(mitra.id, session.tenantId as string, page, 20),
        ])

        return apiSuccess({
            balance: balanceResult.success ? balanceResult.data : { balance: 0, totalEarnings: 0, totalWithdrawn: 0 },
            transactions: txResult.success ? txResult.data : { transactions: [], total: 0 },
        })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Gagal memuat wallet'
        return ApiErrors.internalError(message)
    }
}
