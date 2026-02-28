import { prisma } from '@/lib/prisma'
import { Prisma, WithdrawStatus } from '@prisma/client'
import type { MitraFilters, MitraWithDetails } from '../dto/MitraDTO'

export class MitraRepository {

    /**
     * Get all mitra users with filters and pagination
     */
    async findAll(filters: MitraFilters, page: number = 1, limit: number = 20) {
        const skip = (page - 1) * limit

        const where: Prisma.MitraWhereInput = {
            ...(filters.employeeType && { mitraType: filters.employeeType as Prisma.EnumMitraTypeFilter }),
            ...(filters.isActive !== undefined && { isActive: filters.isActive }),
            ...(filters.siteId && { siteId: filters.siteId }),
            ...(filters.search && {
                OR: [
                    { name: { contains: filters.search, mode: 'insensitive' } },
                    { email: { contains: filters.search, mode: 'insensitive' } },
                    { phone: { contains: filters.search, mode: 'insensitive' } },
                ]
            }),
        }

        const [mitras, total] = await Promise.all([
            prisma.mitra.findMany({
                where,
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                    mitraType: true,
                    isActive: true,
                    mitraRateWo: true,
                    mitraRateCanvasing: true,
                    bankName: true,
                    bankAccountName: true,
                    targetHarian: true,
                    siteId: true,
                    createdAt: true,
                    sites: { select: { name: true } },
                    mitraWallet: {
                        select: {
                            id: true,
                            balance: true,
                            totalEarnings: true,
                            totalWithdrawn: true,
                        }
                    },
                },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.mitra.count({ where }),
        ])

        return { mitras: mitras as unknown as MitraWithDetails[], total, page, totalPages: Math.ceil(total / limit) }
    }

    /**
     * Get single mitra by ID
     */
    async findById(id: string) {
        return prisma.mitra.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                mitraType: true,
                isActive: true,
                mitraRateWo: true,
                mitraRateCanvasing: true,
                bankName: true,
                bankAccountName: true,
                targetHarian: true,
                createdAt: true,
                sites: { select: { id: true, name: true } },
                mitraWallet: {
                    select: {
                        id: true,
                        balance: true,
                        totalEarnings: true,
                        totalWithdrawn: true,
                    }
                },
            },
        })
    }

    /**
     * Get mitra stats (totals by type)
     */
    async getStats() {
        const [totalTeknisi, totalSales, totalActive, totalWalletBalance] = await Promise.all([
            prisma.mitra.count({ where: { mitraType: 'MITRA_TEKNISI' } }),
            prisma.mitra.count({ where: { mitraType: 'MITRA_SALES' } }),
            prisma.mitra.count({ where: { isActive: true } }),
            prisma.mitraWallet.aggregate({ _sum: { balance: true } }),
        ])

        return {
            totalTeknisi,
            totalSales,
            totalActive,
            totalBalance: totalWalletBalance._sum.balance || 0,
        }
    }

    /**
     * Create mitra wallet for a mitra
     */
    async createWallet(mitraId: string) {
        return prisma.mitraWallet.create({
            data: { mitraId },
        })
    }

    /**
     * Get wallet by mitra ID
     */
    async getWalletByUserId(mitraId: string) {
        return prisma.mitraWallet.findUnique({
            where: { mitraId },
            include: {
                transactions: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                },
                withdrawals: {
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                },
            },
        })
    }

    /**
     * Get wallet transactions with pagination
     */
    async getTransactions(walletId: string, page: number = 1, limit: number = 20) {
        const skip = (page - 1) * limit

        const [transactions, total] = await Promise.all([
            prisma.mitraTransaction.findMany({
                where: { walletId },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.mitraTransaction.count({ where: { walletId } }),
        ])

        return { transactions, total, page, totalPages: Math.ceil(total / limit) }
    }

    /**
     * Get withdraw requests with pagination
     */
    async getWithdrawRequests(filters: {
        mitraId?: string
        status?: string
        page?: number
        limit?: number
    }) {
        const { mitraId, status, page = 1, limit = 20 } = filters
        const skip = (page - 1) * limit

        const where: Prisma.WithdrawRequestWhereInput = {
            ...(mitraId && { mitraId }),
            ...(status && { status: status as WithdrawStatus }),
        }

        const [requests, total] = await Promise.all([
            prisma.withdrawRequest.findMany({
                where,
                include: {
                    mitra: {
                        select: { id: true, name: true, email: true, mitraType: true }
                    },
                    processedBy: {
                        select: { id: true, name: true }
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.withdrawRequest.count({ where }),
        ])

        return { requests, total, page, totalPages: Math.ceil(total / limit) }
    }
}

// Singleton
let instance: MitraRepository | null = null
export function getMitraRepository(): MitraRepository {
    if (!instance) instance = new MitraRepository()
    return instance
}
