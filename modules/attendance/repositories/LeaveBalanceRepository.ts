import { prisma } from '@/lib/prisma'
import { LeaveType } from '@prisma/client'
import { randomUUID } from 'crypto'

// Default quotas per leave type per year
export const DEFAULT_LEAVE_QUOTAS: Record<LeaveType, number> = {
    CUTI: 12,
    SAKIT: 6,
    IZIN: 6,
    LAINNYA: 3,
    TUKAR_LIBUR: 999 // Unlimited
}

export class LeaveBalanceRepository {
    /**
     * Get leave balance for a specific user, year, and type
     */
    async getBalance(userId: string, year: number, leaveType: LeaveType) {
        return prisma.leaveBalance.findUnique({
            where: {
                userId_year_leaveType: { userId, year, leaveType }
            }
        })
    }

    /**
     * Get all leave balances for a user in a specific year
     */
    async getUserBalances(userId: string, year: number) {
        return prisma.leaveBalance.findMany({
            where: { userId, year },
            orderBy: { leaveType: 'asc' }
        })
    }

    /**
     * Create or update leave balance quota
     */
    async upsertQuota(userId: string, year: number, leaveType: LeaveType, quota: number) {
        const id = randomUUID()
        return prisma.leaveBalance.upsert({
            where: {
                userId_year_leaveType: { userId, year, leaveType }
            },
            update: {
                quota,
                updatedAt: new Date()
            },
            create: {
                id,
                userId,
                year,
                leaveType,
                quota,
                used: 0,
                updatedAt: new Date()
            }
        })
    }

    /**
     * Initialize yearly balance for a user with default quotas
     */
    async initializeYearlyBalance(userId: string, year: number) {
        const existingBalances = await this.getUserBalances(userId, year)
        const existingTypes = new Set(existingBalances.map(b => b.leaveType))

        const createPromises = Object.entries(DEFAULT_LEAVE_QUOTAS)
            .filter(([type]) => !existingTypes.has(type as LeaveType))
            .map(([type, quota]) => 
                this.upsertQuota(userId, year, type as LeaveType, quota)
            )

        return Promise.all(createPromises)
    }

    /**
     * Increment used leave days (when leave is approved)
     */
    async incrementUsed(userId: string, year: number, leaveType: LeaveType, days: number) {
        // First ensure balance exists
        const balance = await this.getBalance(userId, year, leaveType)
        if (!balance) {
            await this.upsertQuota(userId, year, leaveType, DEFAULT_LEAVE_QUOTAS[leaveType])
        }

        return prisma.leaveBalance.update({
            where: {
                userId_year_leaveType: { userId, year, leaveType }
            },
            data: {
                used: { increment: days },
                updatedAt: new Date()
            }
        })
    }

    /**
     * Decrement used leave days (when leave is cancelled/rejected after approval)
     */
    async decrementUsed(userId: string, year: number, leaveType: LeaveType, days: number) {
        return prisma.leaveBalance.update({
            where: {
                userId_year_leaveType: { userId, year, leaveType }
            },
            data: {
                used: { decrement: days },
                updatedAt: new Date()
            }
        })
    }

    /**
     * Get remaining days for a specific leave type
     */
    async getRemainingDays(userId: string, year: number, leaveType: LeaveType): Promise<number> {
        const balance = await this.getBalance(userId, year, leaveType)
        if (!balance) {
            return DEFAULT_LEAVE_QUOTAS[leaveType]
        }
        return Math.max(0, balance.quota - balance.used)
    }

    /**
     * Check if user has enough leave days
     */
    async hasEnoughDays(userId: string, year: number, leaveType: LeaveType, requiredDays: number): Promise<boolean> {
        const remaining = await this.getRemainingDays(userId, year, leaveType)
        return remaining >= requiredDays
    }

    /**
     * Get all balances with user info for admin view
     */
    async getAllBalances(year: number, filters?: { departmentId?: string; siteId?: string }) {
        const where: { year: number; user?: { departmentId?: string; siteId?: string } } = { year }

        if (filters?.departmentId || filters?.siteId) {
            where.user = {
                ...(filters.departmentId && { departmentId: filters.departmentId }),
                ...(filters.siteId && { siteId: filters.siteId })
            }
        }

        return prisma.leaveBalance.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        departments: { select: { name: true } }
                    }
                }
            },
            orderBy: [
                { user: { name: 'asc' } },
                { leaveType: 'asc' }
            ]
        })
    }
}
