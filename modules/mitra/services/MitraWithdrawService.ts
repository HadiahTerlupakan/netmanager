import { prisma } from '@/lib/prisma'
import { prismaMitra } from '@/lib/prisma-mitra'
import { Prisma, MitraTransactionType, WithdrawStatus } from '@/prisma/generated/mitra'
import { logger, logActivitySafe } from '@/lib/logger'
import type { WithdrawRequestDTO } from '../dto/MitraDTO'

interface ServiceResult<T = void> {
    success: boolean
    data?: T
    error?: string
}

// Default minimum withdraw (can be overridden by Settings)
const DEFAULT_MIN_WITHDRAW = 50000

export class MitraWithdrawService {

    /**
     * Get minimum withdraw amount from Settings
     */
    private async getMinWithdraw(): Promise<number> {
        try {
            const setting = await prisma.settings.findUnique({
                where: { key: 'mitra_min_withdraw' },
            })
            return setting?.value ? parseFloat(setting.value) : DEFAULT_MIN_WITHDRAW
        } catch {
            return DEFAULT_MIN_WITHDRAW
        }
    }

    /**
     * Request withdraw (from mobile app)
     */
    async requestWithdraw(userId: string, data: WithdrawRequestDTO): Promise<ServiceResult<{ id: string }>> {
        try {
            const mitra = await prismaMitra.mitra.findUnique({
                where: { id: userId },
                select: { minWithdrawal: true },
            });

            const defaultMinWithdraw = await this.getMinWithdraw()
            const minWithdraw = mitra?.minWithdrawal ?? defaultMinWithdraw;

            if (data.amount < minWithdraw) {
                return { success: false, error: `Minimum penarikan Anda adalah Rp ${minWithdraw.toLocaleString('id-ID')}` }
            }

            // Validate bank info if method is TRANSFER
            if (data.method === 'TRANSFER') {
                if (!data.bankName || !data.accountNumber || !data.accountName) {
                    return { success: false, error: 'Informasi bank harus diisi untuk metode transfer' }
                }
            }

            // Check pending withdrawals
            const wallet = await prismaMitra.mitraWallet.findUnique({
                where: { mitraId: userId },
            })

            if (!wallet) {
                return { success: false, error: 'Wallet tidak ditemukan' }
            }

            if (wallet.balance < data.amount) {
                return { success: false, error: 'Saldo tidak cukup' }
            }

            // Check if there's already a pending withdrawal
            const pendingCount = await prismaMitra.withdrawRequest.count({
                where: {
                    mitraWalletId: wallet.id,
                    status: { in: ['PENDING', 'APPROVED', 'PROCESSING'] },
                },
            })

            if (pendingCount > 0) {
                return { success: false, error: 'Masih ada request penarikan yang belum selesai' }
            }

            // Create withdraw request
            const id = crypto.randomUUID()
            await prismaMitra.withdrawRequest.create({
                data: {
                    id,
                    mitraId: userId,
                    mitraWalletId: wallet.id,
                    amount: data.amount,
                    method: data.method,
                    bankName: data.bankName,
                    bankAccountNo: data.accountNumber,
                    bankAccountName: data.accountName,
                    notes: data.notes,
                },
            })

            logger.info(`[MitraWithdrawService] Withdraw requested: userId=${userId}, amount=${data.amount}, method=${data.method}`)
            return { success: true, data: { id } }
        } catch (error) {
            logger.error('[MitraWithdrawService] Error requesting withdraw:', error as Error)
            return { success: false, error: 'Gagal membuat request penarikan' }
        }
    }

    /**
     * Approve withdraw request (admin)
     */
    async approveWithdraw(id: string, approvedById: string): Promise<ServiceResult> {
        try {
            const request = await prismaMitra.withdrawRequest.findUnique({
                where: { id },
                include: { mitraWallet: true },
            })

            if (!request) {
                return { success: false, error: 'Request tidak ditemukan' }
            }

            if (request.status !== 'PENDING') {
                return { success: false, error: 'Request sudah diproses' }
            }

            // Check wallet balance
            if (request.mitraWallet.balance < request.amount) {
                return { success: false, error: 'Saldo mitra tidak cukup' }
            }

            await prismaMitra.withdrawRequest.update({
                where: { id },
                data: {
                    status: WithdrawStatus.APPROVED,
                    processedById: approvedById,
                    processedAt: new Date(),
                },
            })

            logActivitySafe({
                action: 'APPROVE',
                subject: 'WithdrawRequest',
                userId: approvedById,
                details: { requestId: id, amount: request.amount },
            })

            return { success: true }
        } catch (error) {
            logger.error('[MitraWithdrawService] Error approving withdraw:', error as Error)
            return { success: false, error: 'Gagal menyetujui penarikan' }
        }
    }

    /**
     * Reject withdraw request (admin)
     */
    async rejectWithdraw(id: string, reason: string, rejectedById: string): Promise<ServiceResult> {
        try {
            const request = await prismaMitra.withdrawRequest.findUnique({
                where: { id },
            })

            if (!request) {
                return { success: false, error: 'Request tidak ditemukan' }
            }

            if (request.status !== 'PENDING') {
                return { success: false, error: 'Request sudah diproses' }
            }

            await prismaMitra.withdrawRequest.update({
                where: { id },
                data: {
                    status: WithdrawStatus.REJECTED,
                    rejectionReason: reason,
                    processedById: rejectedById,
                    processedAt: new Date(),
                },
            })

            logActivitySafe({
                action: 'REJECT',
                subject: 'WithdrawRequest',
                userId: rejectedById,
                details: { requestId: id, reason },
            })

            return { success: true }
        } catch (error) {
            logger.error('[MitraWithdrawService] Error rejecting withdraw:', error as Error)
            return { success: false, error: 'Gagal menolak penarikan' }
        }
    }

    /**
     * Complete withdraw — deduct from wallet and record transaction
     */
    async completeWithdraw(id: string, processedById: string): Promise<ServiceResult> {
        try {
            const request = await prismaMitra.withdrawRequest.findUnique({
                where: { id },
                include: { mitraWallet: true },
            })

            if (!request) {
                return { success: false, error: 'Request tidak ditemukan' }
            }

            if (request.status !== 'APPROVED') {
                return { success: false, error: 'Request belum disetujui' }
            }

            if (request.mitraWallet.balance < request.amount) {
                return { success: false, error: 'Saldo mitra tidak cukup' }
            }

            await prismaMitra.$transaction(async (tx) => {
                // Deduct from wallet
                await tx.mitraWallet.update({
                    where: { id: request.mitraWalletId },
                    data: {
                        balance: { decrement: request.amount },
                        totalWithdrawn: { increment: request.amount },
                    },
                })

                // Create withdraw transaction
                await tx.mitraTransaction.create({
                    data: {
                        walletId: request.mitraWalletId,
                        amount: -request.amount,
                        type: MitraTransactionType.WITHDRAW,
                        description: `Penarikan via ${request.method === 'TRANSFER' ? 'Transfer Bank' : 'Cash'}`,
                        referenceId: request.id,
                        referenceType: 'WITHDRAW',
                    },
                })

                // Update request status
                await tx.withdrawRequest.update({
                    where: { id },
                    data: {
                        status: WithdrawStatus.COMPLETED,
                        processedById,
                        processedAt: new Date(),
                    },
                })
            })

            logActivitySafe({
                action: 'COMPLETE',
                subject: 'WithdrawRequest',
                userId: processedById,
                details: { requestId: id, amount: request.amount, method: request.method },
            })

            logger.info(`[MitraWithdrawService] Withdraw completed: requestId=${id}, amount=${request.amount}`)
            return { success: true }
        } catch (error) {
            logger.error('[MitraWithdrawService] Error completing withdraw:', error as Error)
            return { success: false, error: 'Gagal menyelesaikan penarikan' }
        }
    }

    /**
     * Get withdraw requests (for admin or user)
     */
    async getWithdrawRequests(filters: {
        userId?: string
        status?: string
        page?: number
        limit?: number
    }) {
        try {
            const { userId, status, page = 1, limit = 20 } = filters

            let walletId: string | undefined
            if (userId) {
                const wallet = await prismaMitra.mitraWallet.findUnique({ where: { mitraId: userId } })
                walletId = wallet?.id
                if (!walletId) {
                    return { success: true, data: { requests: [], total: 0, page, totalPages: 0 } }
                }
            }

            const skip = (page - 1) * limit
            const where: Prisma.WithdrawRequestWhereInput = {
                ...(walletId && { mitraWalletId: walletId }),
                ...(status && { status: status as WithdrawStatus }),
            }

            const [requests, total] = await Promise.all([
                prismaMitra.withdrawRequest.findMany({
                    where,
                    include: {
                        mitraWallet: {
                            include: {
                                mitra: { select: { id: true, name: true, email: true, mitraType: true } },
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: limit,
                }),
                prismaMitra.withdrawRequest.count({ where }),
            ])

            return {
                success: true,
                data: { requests, total, page, totalPages: Math.ceil(total / limit) },
            }
        } catch (error) {
            logger.error('[MitraWithdrawService] Error getting withdraw requests:', error as Error)
            return { success: false, error: 'Gagal mengambil data penarikan' }
        }
    }

    /**
     * Get min withdraw setting (for mobile app form)
     */
    async getMinWithdrawSetting(): Promise<ServiceResult<{ minWithdraw: number }>> {
        const minWithdraw = await this.getMinWithdraw()
        return { success: true, data: { minWithdraw } }
    }
}

// Singleton
let instance: MitraWithdrawService | null = null
export function getMitraWithdrawService(): MitraWithdrawService {
    if (!instance) instance = new MitraWithdrawService()
    return instance
}
