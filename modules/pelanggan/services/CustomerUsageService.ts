import { CustomerUsageRepository } from '../repositories/CustomerUsageRepository'

/**
 * Service for customer usage/connection status
 */
export class CustomerUsageService {
    private repository: CustomerUsageRepository

    constructor() {
        this.repository = new CustomerUsageRepository()
    }

    /**
     * Get customer connection status and usage data
     */
    async getUsageData(customerId: string) {
        // Get customer username
        const customer = await this.repository.getCustomerUsername(customerId)
        if (!customer) {
            throw new Error('Data pelanggan tidak ditemukan')
        }

        // Get latest session
        const latestSession = await this.repository.getLatestSession(customer.username)

        // Check if online
        const isOnline = latestSession && !latestSession.acctStopTime

        // Calculate session duration if online
        let sessionDuration = 0
        if (isOnline && latestSession.acctStartTime) {
            sessionDuration = Math.floor(
                (Date.now() - new Date(latestSession.acctStartTime).getTime()) / 1000
            )
        }

        // Get monthly usage
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        const [monthlyUsage, totalUsage] = await Promise.all([
            this.repository.getMonthlyUsage(customer.username, startOfMonth),
            this.repository.getTotalUsage(customer.username),
        ])

        return {
            connection: {
                isOnline,
                ipAddress: isOnline ? latestSession.framedIpAddress : null,
                nasIpAddress: isOnline ? latestSession.nasIpAddress : null,
                sessionId: isOnline ? latestSession.acctSessionId : null,
                sessionStart: isOnline ? latestSession.acctStartTime : null,
                sessionDuration: isOnline ? sessionDuration : 0,
                sessionDurationFormatted: isOnline ? this.formatDuration(sessionDuration) : null,
                lastSeen: latestSession?.acctStopTime || latestSession?.acctUpdateTime || null,
            },
            usage: {
                monthly: {
                    download: this.formatBytes(monthlyUsage._sum.acctInputOctets),
                    upload: this.formatBytes(monthlyUsage._sum.acctOutputOctets),
                    total: this.formatBytes(
                        (monthlyUsage._sum.acctInputOctets || BigInt(0)) +
                        (monthlyUsage._sum.acctOutputOctets || BigInt(0))
                    ),
                    period: {
                        start: startOfMonth,
                        end: new Date(),
                    },
                },
                allTime: {
                    download: this.formatBytes(totalUsage._sum.acctInputOctets),
                    upload: this.formatBytes(totalUsage._sum.acctOutputOctets),
                    total: this.formatBytes(
                        (totalUsage._sum.acctInputOctets || BigInt(0)) +
                        (totalUsage._sum.acctOutputOctets || BigInt(0))
                    ),
                },
            },
        }
    }

    /**
     * Format bytes to human readable
     */
    private formatBytes(bytes: bigint | null) {
        if (!bytes) return { bytes: 0, formatted: '0 B' }
        const numBytes = Number(bytes)
        if (numBytes === 0) return { bytes: 0, formatted: '0 B' }

        const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
        const i = Math.floor(Math.log(numBytes) / Math.log(1024))
        const formatted = parseFloat((numBytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i]

        return { bytes: numBytes, formatted }
    }

    /**
     * Format duration to human readable
     */
    private formatDuration(seconds: number) {
        const hours = Math.floor(seconds / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        const secs = seconds % 60

        if (hours > 0) {
            return `${hours}j ${minutes}m`
        } else if (minutes > 0) {
            return `${minutes}m ${secs}d`
        }
        return `${secs}d`
    }
}
