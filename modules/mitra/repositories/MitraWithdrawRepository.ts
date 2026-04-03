import { prismaMitra } from '@/lib/prisma-mitra'
import { Prisma, WithdrawStatus, MitraTransactionType } from '@prisma/client-mitra'

export class MitraWithdrawRepository {
    async findMitraById(userId: string, tenantId?: string) {
        return prismaMitra.mitra.findFirst({
            where: {
                id: userId,
                ...(tenantId && { tenantId })
            },
            select: { id: true, minWithdrawal: true }
        })
    }

    async findWalletByMitraId(mitraId: string) {
        return prismaMitra.mitraWallet.findUnique({
            where: { mitraId }
        })
    }

    async findWalletByMitraIdWithMitra(mitraId: string, tenantId?: string) {
        return prismaMitra.mitraWallet.findFirst({
            where: {
                mitraId,
                ...(tenantId && { mitra: { tenantId } })
            }
        })
    }

    async countPendingWithdrawals(walletId: string) {
        return prismaMitra.withdrawRequest.count({
            where: {
                mitraWalletId: walletId,
                status: { in: ['PENDING', 'APPROVED', 'PROCESSING'] }
            }
        })
    }

    async createWithdrawRequest(data: Prisma.WithdrawRequestCreateInput) {
        return prismaMitra.withdrawRequest.create({ data })
    }

    async findWithdrawRequestById(id: string, tenantId?: string) {
        return prismaMitra.withdrawRequest.findFirst({
            where: {
                id,
                ...(tenantId && { mitra: { tenantId } })
            },
            include: { mitraWallet: true }
        })
    }

    async findWithdrawRequestByIdSimple(id: string) {
        return prismaMitra.withdrawRequest.findFirst({
            where: { id }
        })
    }

    async updateWithdrawRequest(id: string, data: Prisma.WithdrawRequestUpdateInput) {
        return prismaMitra.withdrawRequest.update({
            where: { id },
            data
        })
    }

    async findWithdrawRequests(where: Prisma.WithdrawRequestWhereInput, include?: Prisma.WithdrawRequestInclude, skip?: number, take?: number) {
        return prismaMitra.withdrawRequest.findMany({
            where,
            ...(include ? { include } : {}),
            ...(skip !== undefined ? { skip } : {}),
            ...(take !== undefined ? { take } : {}),
            orderBy: { createdAt: 'desc' }
        })
    }

    async countWithdrawRequests(where: Prisma.WithdrawRequestWhereInput) {
        return prismaMitra.withdrawRequest.count({ where })
    }

    async completeWithdraw(walletId: string, amount: number, requestId: string, method: string, processedById: string) {
        return prismaMitra.$transaction(async (tx) => {
            await tx.mitraWallet.update({
                where: { id: walletId },
                data: {
                    balance: { decrement: amount },
                    totalWithdrawn: { increment: amount }
                }
            })

            await tx.mitraTransaction.create({
                data: {
                    walletId,
                    amount: -amount,
                    type: MitraTransactionType.WITHDRAW,
                    description: `Penarikan via ${method === 'TRANSFER' ? 'Transfer Bank' : 'Cash'}`,
                    referenceId: requestId,
                    referenceType: 'WITHDRAW'
                }
            })

            await tx.withdrawRequest.update({
                where: { id: requestId },
                data: {
                    status: WithdrawStatus.COMPLETED,
                    processedById,
                    processedAt: new Date()
                }
            })
        })
    }
}
