import { prismaMitra } from '@/lib/prisma-mitra'
import { MitraTransactionType } from '@/prisma/generated/mitra'
import { logger } from '@/lib/logger'

interface ServiceResult<T = void> {
    success: boolean
    data?: T
    error?: string
}

export class MitraWalletService {

    /**
     * Get wallet balance for a user
     */
    async getBalance(userId: string): Promise<ServiceResult<{
        balance: number
        totalEarnings: number
        totalWithdrawn: number
    }>> {
        try {
            let wallet = await prismaMitra.mitraWallet.findFirst({
                where: { mitraId: userId },
            })

            // Auto-create wallet if user is mitra but doesn't have one
            if (!wallet) {
                const user = await prismaMitra.mitra.findFirst({
                    where: { id: userId },
                    select: { mitraType: true },
                })

                if (user && ['MITRA_TEKNISI', 'MITRA_SALES'].includes(user.mitraType)) {
                    wallet = await prismaMitra.mitraWallet.create({
                        data: { mitraId: userId },
                    })
                } else {
                    return { success: false, error: 'User bukan mitra' }
                }
            }

            return {
                success: true,
                data: {
                    balance: wallet.balance,
                    totalEarnings: wallet.totalEarnings,
                    totalWithdrawn: wallet.totalWithdrawn,
                },
            }
        } catch (error) {
            logger.error('[MitraWalletService] Error getting balance:', error as Error)
            return { success: false, error: 'Gagal mengambil saldo' }
        }
    }

    /**
     * Add earning to mitra wallet (called automatically when WO completed or canvasing installed)
     */
    async addEarning(
        userId: string,
        amount: number,
        description: string,
        referenceId?: string,
        referenceType?: 'WORK_ORDER' | 'CANVASING'
    ): Promise<ServiceResult> {
        try {
            if (amount <= 0) {
                return { success: false, error: 'Jumlah harus lebih dari 0' }
            }

            await prismaMitra.$transaction(async (tx) => {
                // Ensure wallet exists
                let wallet = await tx.mitraWallet.findFirst({
                    where: { mitraId: userId },
                })

                if (!wallet) {
                    wallet = await tx.mitraWallet.create({
                        data: { mitraId: userId },
                    })
                }

                // Check for duplicate transaction (same referenceId)
                if (referenceId) {
                    const existing = await tx.mitraTransaction.findFirst({
                        where: { walletId: wallet.id, referenceId, type: 'EARNING' },
                    })
                    if (existing) {
                        throw new Error('Transaksi sudah ada untuk referensi ini')
                    }
                }

                // Create transaction
                await tx.mitraTransaction.create({
                    data: {
                        walletId: wallet.id,
                        amount,
                        type: MitraTransactionType.EARNING,
                        description,
                        referenceId,
                        referenceType,
                    },
                })

                // Update wallet balance
                await tx.mitraWallet.update({
                    where: { id: wallet.id },
                    data: {
                        balance: { increment: amount },
                        totalEarnings: { increment: amount },
                    },
                })
            })

            logger.info(`[MitraWalletService] Earning added: userId=${userId}, amount=${amount}, ref=${referenceId}`)
            return { success: true }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Gagal menambah pendapatan'
            logger.error('[MitraWalletService] Error adding earning:', error as Error)
            return { success: false, error: message }
        }
    }

    /**
     * Deduct balance from mitra wallet (called automatically when warranty SLA is violated)
     */
    async deductBalance(
        userId: string,
        amount: number,
        description: string,
        referenceId?: string,
        referenceType?: 'WORK_ORDER' | 'CANVASING'
    ): Promise<ServiceResult> {
        try {
            if (amount <= 0) {
                return { success: false, error: 'Jumlah harus lebih dari 0' }
            }

            await prismaMitra.$transaction(async (tx) => {
                // Ensure wallet exists
                let wallet = await tx.mitraWallet.findFirst({
                    where: { mitraId: userId },
                })

                if (!wallet) {
                    wallet = await tx.mitraWallet.create({
                        data: { mitraId: userId },
                    })
                }

                // Check for duplicate transaction (same referenceId and type)
                if (referenceId) {
                    const existing = await tx.mitraTransaction.findFirst({
                        where: { walletId: wallet.id, referenceId, type: 'ADJUSTMENT', description: { contains: '[PENALTY]' } },
                    })
                    if (existing) {
                        throw new Error('Transaksi penalti sudah ada untuk referensi ini')
                    }
                }

                // Create transaction
                await tx.mitraTransaction.create({
                    data: {
                        walletId: wallet.id,
                        amount: -amount,
                        type: MitraTransactionType.ADJUSTMENT,
                        description: `[PENALTY] ${description}`,
                        referenceId,
                        referenceType,
                    },
                })

                // Update wallet balance (allow negative balance if penalty exceeds earnings)
                await tx.mitraWallet.update({
                    where: { id: wallet.id },
                    data: {
                        balance: { decrement: amount },
                    },
                })
            })

            logger.info(`[MitraWalletService] Penalty deducted: userId=${userId}, amount=${amount}, ref=${referenceId}`)
            return { success: true }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Gagal memotong saldo'
            logger.error('[MitraWalletService] Error deducting balance:', error as Error)
            return { success: false, error: message }
        }
    }

    /**
     * Manual adjustment by admin (can be positive or negative)
     */
    async addAdjustment(
        userId: string,
        amount: number,
        description: string,
        adminId: string
    ): Promise<ServiceResult> {
        try {
            await prismaMitra.$transaction(async (tx) => {
                const wallet = await tx.mitraWallet.findFirst({
                    where: { mitraId: userId },
                })

                if (!wallet) {
                    throw new Error('Wallet mitra tidak ditemukan')
                }

                // If negative adjustment, check balance
                if (amount < 0 && (wallet.balance + amount) < 0) {
                    throw new Error('Saldo tidak cukup untuk penyesuaian ini')
                }

                // Create transaction
                await tx.mitraTransaction.create({
                    data: {
                        walletId: wallet.id,
                        amount,
                        type: MitraTransactionType.ADJUSTMENT,
                        description: `[Admin] ${description}`,
                    },
                })

                // Update balance
                await tx.mitraWallet.update({
                    where: { id: wallet.id },
                    data: {
                        balance: { increment: amount },
                        totalEarnings: amount > 0 ? { increment: amount } : undefined,
                    },
                })
            })

            logger.info(`[MitraWalletService] Adjustment: userId=${userId}, amount=${amount}, by=${adminId}`)
            return { success: true }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Gagal melakukan penyesuaian'
            logger.error('[MitraWalletService] Error adjusting:', error as Error)
            return { success: false, error: message }
        }
    }

    /**
     * Get transaction history
     */
    async getTransactions(userId: string, page: number = 1, limit: number = 20) {
        try {
            const wallet = await prismaMitra.mitraWallet.findFirst({
                where: { mitraId: userId },
            })

            if (!wallet) {
                return { success: true, data: { transactions: [], total: 0, page, totalPages: 0 } }
            }

            const skip = (page - 1) * limit

            const [transactions, total] = await Promise.all([
                prismaMitra.mitraTransaction.findMany({
                    where: { walletId: wallet.id },
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: limit,
                }),
                prismaMitra.mitraTransaction.count({ where: { walletId: wallet.id } }),
            ])

            return {
                success: true,
                data: {
                    transactions,
                    total,
                    page,
                    totalPages: Math.ceil(total / limit),
                },
            }
        } catch (error) {
            logger.error('[MitraWalletService] Error getting transactions:', error as Error)
            return { success: false, error: 'Gagal mengambil riwayat transaksi' }
        }
    }

    /**
     * Get earnings summary for a period (for dashboard)
     */
    async getEarningsSummary(userId: string, month?: number, year?: number) {
        try {
            const wallet = await prismaMitra.mitraWallet.findFirst({
                where: { mitraId: userId },
            })

            if (!wallet) {
                return {
                    success: true,
                    data: { balance: 0, totalEarnings: 0, totalWithdrawn: 0, earningsThisMonth: 0, earningsCount: 0 },
                }
            }

            // Calculate date range for current/specified month
            const now = new Date()
            const targetMonth = month ?? (now.getMonth() + 1)
            const targetYear = year ?? now.getFullYear()
            const startDate = new Date(targetYear, targetMonth - 1, 1)
            const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59)

            const [monthlyEarnings, monthlyCount] = await Promise.all([
                prismaMitra.mitraTransaction.aggregate({
                    where: {
                        walletId: wallet.id,
                        type: 'EARNING',
                        createdAt: { gte: startDate, lte: endDate },
                    },
                    _sum: { amount: true },
                }),
                prismaMitra.mitraTransaction.count({
                    where: {
                        walletId: wallet.id,
                        type: 'EARNING',
                        createdAt: { gte: startDate, lte: endDate },
                    },
                }),
            ])

            return {
                success: true,
                data: {
                    balance: wallet.balance,
                    totalEarnings: wallet.totalEarnings,
                    totalWithdrawn: wallet.totalWithdrawn,
                    earningsThisMonth: monthlyEarnings._sum.amount || 0,
                    earningsCount: monthlyCount,
                },
            }
        } catch (error) {
            logger.error('[MitraWalletService] Error getting earnings summary:', error as Error)
            return { success: false, error: 'Gagal mengambil ringkasan pendapatan' }
        }
    }
}

// Singleton
let instance: MitraWalletService | null = null
export function getMitraWalletService(): MitraWalletService {
    if (!instance) instance = new MitraWalletService()
    return instance
}
