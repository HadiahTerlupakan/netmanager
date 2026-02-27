import { NextRequest } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { apiSuccess, ApiErrors } from '@/lib/api-response'
import { getMitraWalletService } from '@/modules/mitra'
import { prisma } from '@/lib/prisma'

const walletService = getMitraWalletService()

interface MitraUser {
    id: string
    mitraType: string
    mitraRateWo: number | null
    mitraRateCanvasing: number | null
}

// GET /api/mobile/mitra/dashboard — Mitra dashboard stats
export async function GET(req: NextRequest) {
    try {
        const session = await verifyAuth(req)
        if (!session) return ApiErrors.unauthorized('Tidak terautentikasi')

        if (session.role !== 'MITRA') {
            return ApiErrors.forbidden('Bukan akun mitra')
        }

        const mitra = await prisma.mitra.findUnique({
            where: { id: session.id },
            select: {
                id: true,
                mitraType: true,
                mitraRateWo: true,
                mitraRateCanvasing: true,
            },
        }) as unknown as MitraUser | null

        if (!mitra) return ApiErrors.notFound('Mitra tidak ditemukan')

        // Get wallet balance
        const balanceResult = await walletService.getBalance(mitra.id)
        const balance = balanceResult.success ? balanceResult.data : { balance: 0, totalEarnings: 0, totalWithdrawn: 0 }

        // Get earnings summary
        const monthlyResult = await walletService.getEarningsSummary(mitra.id)
        const monthlyEarnings = monthlyResult.success ? monthlyResult.data : null

        // Get pending withdrawals count
        const pendingWithdrawals = await (prisma as unknown as Record<string, { count: (args: Record<string, unknown>) => Promise<number> }>).withdrawRequest.count({
            where: {
                mitraId: mitra.id,
                status: 'PENDING',
            },
        })

        // Get recent transactions (last 5)
        const txResult = await walletService.getTransactions(mitra.id, 1, 5)
        const recentTransactions = txResult.success ? txResult.data?.transactions || [] : []

        // Get completed jobs count this month
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

        const mitraTx = (prisma as unknown as Record<string, { count: (args: Record<string, unknown>) => Promise<number> }>).mitraTransaction
        let completedJobs = 0
        if (mitra.mitraType === 'MITRA_TEKNISI') {
            completedJobs = await mitraTx.count({
                where: {
                    wallet: { mitraId: mitra.id },
                    type: 'EARNING',
                    description: { contains: 'WO' },
                    createdAt: { gte: startOfMonth },
                },
            })
        } else {
            completedJobs = await mitraTx.count({
                where: {
                    wallet: { mitraId: mitra.id },
                    type: 'EARNING',
                    description: { contains: 'Canvasing' },
                    createdAt: { gte: startOfMonth },
                },
            })
        }

        return apiSuccess({
            employeeType: mitra.mitraType,
            rate: mitra.mitraType === 'MITRA_TEKNISI' ? mitra.mitraRateWo : mitra.mitraRateCanvasing,
            balance: balance?.balance || 0,
            totalEarnings: balance?.totalEarnings || 0,
            totalWithdrawn: balance?.totalWithdrawn || 0,
            completedJobsThisMonth: completedJobs,
            pendingWithdrawals,
            monthlyEarnings,
            recentTransactions,
        })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Gagal memuat dashboard'
        return ApiErrors.internalError(message)
    }
}
