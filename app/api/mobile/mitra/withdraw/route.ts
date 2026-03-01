import { NextRequest } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { apiSuccess, ApiErrors } from '@/lib/api-response'
import { getMitraWithdrawService } from '@/modules/mitra'
import { prisma } from '@/lib/prisma'
import { prismaMitra } from '@/lib/prisma-mitra'

const withdrawService = getMitraWithdrawService()

// GET /api/mobile/mitra/withdraw — List user's withdrawal history
export async function GET(req: NextRequest) {
    try {
        const session = await verifyAuth(req)
        if (!session) return ApiErrors.unauthorized('Tidak terautentikasi')

        if (session.role !== 'MITRA') {
            return ApiErrors.forbidden('Bukan akun mitra')
        }

        const mitra = await prismaMitra.mitra.findUnique({
            where: { id: session.id },
            select: {
                id: true,
                mitraType: true,
                bankName: true,
                bankAccountNo: true,
                bankAccountName: true,
            },
        })

        if (!mitra) return ApiErrors.notFound('Mitra tidak ditemukan')

        const wallet = await prismaMitra.mitraWallet.findUnique({
            where: { mitraId: mitra.id },
        })

        if (!wallet) {
            return apiSuccess({
                bankInfo: { bankName: mitra.bankName, accountNo: mitra.bankAccountNo, accountName: mitra.bankAccountName },
                withdrawals: [],
                total: 0,
            })
        }

        const { searchParams } = new URL(req.url)
        const page = parseInt(searchParams.get('page') || '1')
        const limit = 20
        const skip = (page - 1) * limit

        const [withdrawals, total] = await Promise.all([
            prismaMitra.withdrawRequest.findMany({
                where: { mitraWalletId: wallet.id },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                // include: { processedBy: { select: { name: true } } }, // Cross-DB removed
            }),
            prismaMitra.withdrawRequest.count({ where: { mitraWalletId: wallet.id } }),
        ])

        return apiSuccess({
            bankInfo: { bankName: mitra.bankName, accountNo: mitra.bankAccountNo, accountName: mitra.bankAccountName },
            withdrawals,
            total,
        })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Gagal memuat riwayat penarikan'
        return ApiErrors.internalError(message)
    }
}

// POST /api/mobile/mitra/withdraw — Create withdrawal request
export async function POST(req: NextRequest) {
    try {
        const session = await verifyAuth(req)
        if (!session) return ApiErrors.unauthorized('Tidak terautentikasi')

        if (session.role !== 'MITRA') {
            return ApiErrors.forbidden('Bukan akun mitra')
        }

        const mitra = await prismaMitra.mitra.findUnique({
            where: { id: session.id },
            select: { id: true, mitraType: true },
        })

        if (!mitra) return ApiErrors.notFound('Mitra tidak ditemukan')

        const body = await req.json()
        const { amount, method, bankName, accountNumber, accountName, notes } = body

        if (!amount || amount <= 0) {
            return ApiErrors.badRequest('Jumlah penarikan harus lebih dari 0')
        }

        if (!method || !['TRANSFER', 'CASH'].includes(method)) {
            return ApiErrors.badRequest('Metode penarikan tidak valid')
        }

        const result = await withdrawService.requestWithdraw(mitra.id, {
            amount,
            method,
            bankName: bankName || undefined,
            accountNumber: accountNumber || undefined,
            accountName: accountName || undefined,
            notes: notes || undefined,
        })

        if (!result.success) {
            return ApiErrors.badRequest(result.error || 'Gagal membuat permintaan penarikan')
        }

        return apiSuccess({ message: 'Permintaan penarikan berhasil dibuat' })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Gagal membuat penarikan'
        return ApiErrors.internalError(message)
    }
}
