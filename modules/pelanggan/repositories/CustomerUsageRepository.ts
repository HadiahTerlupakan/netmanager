import { prisma } from '@/lib/prisma'

/**
 * Repository for customer usage/RADIUS data access
 */
export class CustomerUsageRepository {
    /**
     * Get customer with username for RADIUS lookup
     */
    async getCustomerUsername(customerId: string) {
        return prisma.pelanggan.findUnique({
            where: { id: customerId },
            select: {
                id: true,
                username: true,
                status: true,
            },
        })
    }

    /**
     * Get latest RADIUS session for username
     */
    async getLatestSession(username: string) {
        return prisma.radacct.findFirst({
            where: { username },
            orderBy: { acctStartTime: 'desc' },
        })
    }

    /**
     * Get monthly usage aggregate
     */
    async getMonthlyUsage(username: string, startOfMonth: Date) {
        return prisma.radacct.aggregate({
            where: {
                username,
                acctStartTime: { gte: startOfMonth },
            },
            _sum: {
                acctInputOctets: true,
                acctOutputOctets: true,
            },
        })
    }

    /**
     * Get total usage aggregate (all time)
     */
    async getTotalUsage(username: string) {
        return prisma.radacct.aggregate({
            where: { username },
            _sum: {
                acctInputOctets: true,
                acctOutputOctets: true,
            },
        })
    }
}
