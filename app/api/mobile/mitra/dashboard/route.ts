import { NextRequest } from 'next/server'
import { getMobileAuthPayload } from '@/lib/mobile-api-auth'
import { apiSuccess, ApiErrors } from '@/lib/api-response'
import { getMitraWalletService } from '@/modules/mitra'
import { prismaMitra } from '@/lib/prisma-mitra'
import { prismaBilling } from '@/lib/prisma-billing'
import { toStartOfDay } from '@/lib/utils/server-datetime'


const walletService = getMitraWalletService()

// GET /api/mobile/mitra/dashboard — Mitra dashboard stats
export async function GET(req: NextRequest) {
    try {
        const authResult = await getMobileAuthPayload(req)
        if (authResult instanceof Response) return authResult

        const session = authResult

        if (session.role !== 'MITRA') {
            return ApiErrors.forbidden('Bukan akun mitra')
        }

        const tenantId = session.tenantId as string

        const mitra = await prismaMitra.mitra.findFirst({
            where: { 
                id: session.id,
                ...(tenantId && { tenantId })
            },
            select: {
                id: true,
                mitraType: true,
                mitraRateWoPsb: true,
                mitraRateWoMaintenance: true,
                mitraRateCanvasing: true,
                mitraRateFeePelanggan: true,
                enableFeePelanggan: true,
                mixradiusOwnerNames: true,
                targetHarian: true,
                minWithdrawal: true,
            },
        })

        if (!mitra) return ApiErrors.notFound('Mitra tidak ditemukan')

        // Get wallet balance
        const balanceResult = await walletService.getBalance(mitra.id, tenantId)
        const balance = balanceResult.success ? balanceResult.data : { balance: 0, totalEarnings: 0, totalWithdrawn: 0 }

        // Get earnings summary
        const monthlyResult = await walletService.getEarningsSummary(mitra.id, tenantId)
        const monthlyEarnings = monthlyResult.success ? monthlyResult.data : null

        // Get pending withdrawals count
        const pendingWithdrawals = await prismaMitra.withdrawRequest.count({
            where: {
                mitraId: mitra.id,
                status: 'PENDING',
                ...(tenantId && { mitra: { tenantId } })
            },
        })

        // Get recent transactions (last 5)
        const txResult = await walletService.getTransactions(mitra.id, tenantId, 1, 5)
        const recentTransactions = txResult.success ? txResult.data?.transactions || [] : []

        // Get completed jobs count this month
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

        let completedJobs = 0
        if (mitra.mitraType === 'MITRA_TEKNISI') {
            completedJobs = await prismaMitra.mitraTransaction.count({
                where: {
                    wallet: { mitraId: mitra.id },
                    type: 'EARNING',
                    description: { contains: 'WO' },
                    createdAt: { gte: startOfMonth },
                },
            })
        } else {
            completedJobs = await prismaMitra.mitraTransaction.count({
                where: {
                    wallet: { mitraId: mitra.id },
                    type: 'EARNING',
                    description: { contains: 'Canvasing' },
                    createdAt: { gte: startOfMonth },
                },
            })
        }

        // Calculate Fee Pelanggan for MITRA_SALES if enabled
        let activeCustomers = 0
        let totalFeePelanggan = 0
        let remainingFeePelanggan = 0
        let unpaidCustomersCount = 0

        if (mitra.mitraType === 'MITRA_SALES' && mitra.enableFeePelanggan) {
            try {
                const today = new Date()
                today.setTime(toStartOfDay(today).getTime())

                // Settlement T-1: data strictly before today 00:00
                const yesterdayEnd = new Date(today)
                yesterdayEnd.setMilliseconds(-1)

                const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
                const currentMonthKey = startOfMonth.toISOString().substring(0, 7)

                // Query local MixRadiusInvoice table instead of external API
                const invoices = await prismaBilling.mixRadiusInvoice.findMany({
                    where: {
                        status: 'PAID',
                        issuedDate: {
                            gte: startOfMonth,
                            lte: yesterdayEnd
                        },
                        // Filter by ownerName parity with mitra.mixradiusOwnerNames
                        ownerName: {
                            in: mitra.mixradiusOwnerNames || []
                        }
                    },
                    select: {
                        username: true,
                        invoiceNumber: true
                    }
                })

                // Use a set to count unique customers for this period s.d. T-1
                const uniqueMembers = new Set()
                invoices.forEach((r: { username: string }) => {
                    uniqueMembers.add(r.username)
                })

                activeCustomers = uniqueMembers.size
                totalFeePelanggan = activeCustomers * (mitra.mitraRateFeePelanggan || 0)

                const syncedFees = await prismaMitra.mitraTransaction.aggregate({
                    where: {
                        wallet: { mitraId: mitra.id },
                        type: 'EARNING',
                        referenceId: { startsWith: `PAYOUT-FEE-${currentMonthKey}-` }
                    },
                    _sum: { amount: true }
                })
                const totalSynced = Number(syncedFees._sum.amount || 0)
                remainingFeePelanggan = Math.max(0, totalFeePelanggan - totalSynced)

                unpaidCustomersCount = mitra.mitraRateFeePelanggan && mitra.mitraRateFeePelanggan > 0
                    ? Math.floor(remainingFeePelanggan / mitra.mitraRateFeePelanggan)
                    : 0
            } catch (err) {
                console.error('[Mobile API] Error fetching local MixRadius fee:', err)
            }
        }

        return apiSuccess({
            employeeType: mitra.mitraType,
            ratePsb: mitra.mitraRateWoPsb,
            rateMaintenance: mitra.mitraRateWoMaintenance,
            rateCanvasing: mitra.mitraRateCanvasing,
            minWithdrawal: mitra.minWithdrawal,
            balance: balance?.balance || 0,
            totalEarnings: (balance?.totalEarnings || 0) + remainingFeePelanggan,
            totalWithdrawn: balance?.totalWithdrawn || 0,
            completedJobsThisMonth: completedJobs,
            activeCustomers: unpaidCustomersCount, // Show only unpaid customers to reflect "resets to 0"
            totalActiveCustomers: activeCustomers, // Provide total for other uses if needed
            targetHarian: mitra.targetHarian,
            enableFeePelanggan: mitra.enableFeePelanggan || false,
            pendingWithdrawals,
            monthlyEarnings,
            recentTransactions,
        })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Gagal memuat dashboard'
        return ApiErrors.internalError(message)
    }
}
