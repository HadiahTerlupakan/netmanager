import { randomUUID } from 'crypto'
import { WithdrawStatus, Prisma } from '@prisma/client-mitra'
import { logger, logActivitySafe } from '@/lib/logger'
import type { WithdrawRequestDTO } from '../dto/MitraDTO'
import { MitraWithdrawRepository } from '../repositories/MitraWithdrawRepository'
import { SettingsRepository } from '@/modules/attendance/repositories/SettingsRepository'

interface ServiceResult<T = void> {
    success: boolean
    data?: T
    error?: string
}

const DEFAULT_MIN_WITHDRAW = 50000

export class MitraWithdrawService {
    private withdrawRepo = new MitraWithdrawRepository()
    private settingsRepo = new SettingsRepository()

    private async getMinWithdraw(): Promise<number> {
        try {
            const setting = await this.settingsRepo.findByKey('mitra_min_withdraw')
            return setting?.value ? parseFloat(setting.value) : DEFAULT_MIN_WITHDRAW
        } catch {
            return DEFAULT_MIN_WITHDRAW
        }
    }

    async requestWithdraw(userId: string, data: WithdrawRequestDTO, tenantId?: string): Promise<ServiceResult<{ id: string }>> {
        try {
            const mitra = await this.withdrawRepo.findMitraById(userId, tenantId)

            if (!mitra) {
                return { success: false, error: 'Mitra tidak ditemukan' }
            }

            const defaultMinWithdraw = await this.getMinWithdraw()
            const minWithdraw = mitra.minWithdrawal ?? defaultMinWithdraw

            if (data.amount < minWithdraw) {
                return { success: false, error: `Minimum penarikan Anda adalah Rp ${minWithdraw.toLocaleString('id-ID')}` }
            }

            if (data.method === 'TRANSFER') {
                if (!data.bankName || !data.accountNumber || !data.accountName) {
                    return { success: false, error: 'Informasi bank harus diisi untuk metode transfer' }
                }
            }

            const wallet = await this.withdrawRepo.findWalletByMitraId(userId)

            if (!wallet) {
                return { success: false, error: 'Wallet tidak ditemukan' }
            }

            if (wallet.balance.toNumber() < data.amount) {
                return { success: false, error: 'Saldo tidak cukup' }
            }

            const pendingCount = await this.withdrawRepo.countPendingWithdrawals(wallet.id)

            if (pendingCount > 0) {
                return { success: false, error: 'Masih ada request penarikan yang belum selesai' }
            }

            const id = randomUUID()
            await this.withdrawRepo.createWithdrawRequest({
                id,
                mitra: { connect: { id: userId } },
                mitraWallet: { connect: { id: wallet.id } },
                amount: data.amount,
                method: data.method,
                bankName: data.bankName,
                bankAccountNo: data.accountNumber,
                bankAccountName: data.accountName,
                notes: data.notes,
            })

            logger.info(`[MitraWithdrawService] Withdraw requested: userId=${userId}, amount=${data.amount}, method=${data.method}`)
            return { success: true, data: { id } }
        } catch (error) {
            logger.error('[MitraWithdrawService] Error requesting withdraw:', error as Error)
            return { success: false, error: 'Gagal membuat request penarikan' }
        }
    }

    async approveWithdraw(id: string, approvedById: string, tenantId?: string): Promise<ServiceResult> {
        try {
            const request = await this.withdrawRepo.findWithdrawRequestById(id, tenantId)

            if (!request) {
                return { success: false, error: 'Request tidak ditemukan' }
            }

            if (request.status !== 'PENDING') {
                return { success: false, error: 'Request sudah diproses' }
            }

            if (request.mitraWallet.balance.toNumber() < request.amount) {
                return { success: false, error: 'Saldo mitra tidak cukup' }
            }

            await this.withdrawRepo.updateWithdrawRequest(id, {
                status: WithdrawStatus.APPROVED,
                processedById: approvedById,
                processedAt: new Date(),
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

    async rejectWithdraw(id: string, reason: string, rejectedById: string, _tenantId?: string): Promise<ServiceResult> {
        try {
            const request = await this.withdrawRepo.findWithdrawRequestByIdSimple(id)

            if (!request) {
                return { success: false, error: 'Request tidak ditemukan' }
            }

            if (request.status !== 'PENDING') {
                return { success: false, error: 'Request sudah diproses' }
            }

            await this.withdrawRepo.updateWithdrawRequest(id, {
                status: WithdrawStatus.REJECTED,
                rejectionReason: reason,
                processedById: rejectedById,
                processedAt: new Date(),
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

    async completeWithdraw(id: string, processedById: string, tenantId?: string): Promise<ServiceResult> {
        try {
            const request = await this.withdrawRepo.findWithdrawRequestById(id, tenantId)

            if (!request) {
                return { success: false, error: 'Request tidak ditemukan' }
            }

            if (request.status !== 'APPROVED') {
                return { success: false, error: 'Request belum disetujui' }
            }

            if (request.mitraWallet.balance.toNumber() < request.amount) {
                return { success: false, error: 'Saldo mitra tidak cukup' }
            }

            await this.withdrawRepo.completeWithdraw(
                request.mitraWalletId,
                request.amount,
                id,
                request.method,
                processedById,
            )

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

    async getWithdrawRequests(filters: {
        userId?: string
        status?: string
        page?: number
        limit?: number
        tenantId?: string
    }) {
        try {
            const { userId, status, page = 1, limit = 20, tenantId } = filters

            let walletId: string | undefined
            if (userId) {
                const wallet = await this.withdrawRepo.findWalletByMitraIdWithMitra(userId, tenantId)
                walletId = wallet?.id
                if (!walletId) {
                    return { success: true, data: { requests: [], total: 0, page, totalPages: 0 } }
                }
            }

            const skip = (page - 1) * limit
            const where: Prisma.WithdrawRequestWhereInput = {
                ...(walletId && { mitraWalletId: walletId }),
                ...(status && { status: status as WithdrawStatus }),
                ...(tenantId && !userId && { mitra: { tenantId } }),
            }

            const [requests, total] = await Promise.all([
                this.withdrawRepo.findWithdrawRequests(
                    where,
                    {
                        mitraWallet: {
                            include: {
                                mitra: { select: { id: true, name: true, email: true, mitraType: true } },
                            },
                        },
                    },
                    skip,
                    limit,
                ),
                this.withdrawRepo.countWithdrawRequests(where),
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

    async getMinWithdrawSetting(): Promise<ServiceResult<{ minWithdraw: number }>> {
        const minWithdraw = await this.getMinWithdraw()
        return { success: true, data: { minWithdraw } }
    }
}

let instance: MitraWithdrawService | null = null
export function getMitraWithdrawService(): MitraWithdrawService {
    if (!instance) instance = new MitraWithdrawService()
    return instance
}
