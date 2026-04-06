import { prismaRadius } from '@/lib/prisma-radius';
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

    async getStaticIpReply(username: string, tenantId?: string | null) {
        return prismaRadius.radreply.findFirst({
            where: tenantId
                ? {
                    username,
                    attribute: 'Framed-IP-Address',
                    OR: [
                        { tenantId },
                        { tenantId: null },
                    ],
                }
                : {
                    username,
                    attribute: 'Framed-IP-Address',
                    tenantId: null,
                },
            orderBy: { id: 'desc' },
            select: { value: true },
        })
    }

    async getLatestSessionForTechnicalInfo(username: string, tenantId?: string | null) {
        return prismaRadius.radacct.findFirst({
            where: tenantId
                ? {
                    username,
                    OR: [
                        { tenantId },
                        { tenantId: null },
                    ],
                }
                : {
                    username,
                    tenantId: null,
                },
            orderBy: [
                { acctupdatetime: 'desc' },
                { acctstarttime: 'desc' },
            ],
            select: {
                framedipaddress: true,
                nasipaddress: true,
            },
        })
    }

    async getRouterNameByNasIp(nasIpAddress: string, tenantId?: string | null) {
        return prisma.mikroTikRouter.findFirst({
            where: tenantId
                ? {
                    ipAddress: nasIpAddress,
                    OR: [
                        { tenantId },
                        { tenantId: null },
                    ],
                }
                : { ipAddress: nasIpAddress },
            select: { name: true },
        })
    }

    /**
     * Get latest RADIUS session for username
     */
    async getLatestSession(username: string) {
        return prismaRadius.radacct.findFirst({
            where: { username },
            orderBy: { acctstarttime: 'desc' },
        })
    }

    /**
     * Get monthly usage aggregate
     */
    async getMonthlyUsage(username: string, startOfMonth: Date) {
        return prismaRadius.radacct.aggregate({
            where: {
                username,
                acctstarttime: { gte: startOfMonth },
            },
            _sum: {
                acctinputoctets: true,
                acctoutputoctets: true,
            },
        })
    }

    /**
     * Get total usage aggregate (all time)
     */
    async getTotalUsage(username: string) {
        return prismaRadius.radacct.aggregate({
            where: { username },
            _sum: {
                acctinputoctets: true,
                acctoutputoctets: true,
            },
        })
    }
}
