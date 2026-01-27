import { prisma } from '@/lib/prisma'
import type { SalaryConfig, RateType, Prisma } from '@prisma/client'


export class SalaryConfigRepository {
    /**
     * Get active config (there should only be one active)
     */
    async getActiveConfig(): Promise<SalaryConfig | null> {
        return prisma.salaryConfig.findFirst({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' }
        })
    }

    /**
     * Get or create default config
     */
    async getOrCreateConfig(): Promise<SalaryConfig> {
        const existing = await this.getActiveConfig()
        if (existing) return existing

        // Create default config
        return prisma.salaryConfig.create({
            data: {
                payPeriodDay: 25,
                payDay: 1,
                overtimeRateType: 'PER_HOUR',
                overtimeRateNormal: 50000,
                overtimeRateHoliday: 75000,
                overtimeRateNational: 100000,
                woIncentiveEnabled: true,
                woIncentiveRate: 25000,
                lateDeductionRate: 25000,
                absentDeductionRate: 100000,
                isActive: true
            }
        })
    }

    /**
     * Update config
     */
    async updateConfig(id: string, data: Prisma.SalaryConfigUpdateInput): Promise<SalaryConfig> {
        return prisma.salaryConfig.update({
            where: { id },
            data: {
                ...data,
                updatedAt: new Date()
            }
        })
    }

    /**
     * Create new config (deactivates others)
     */
    async createConfig(data: Omit<Prisma.SalaryConfigCreateInput, 'isActive'>): Promise<SalaryConfig> {
        // Deactivate existing configs
        await prisma.salaryConfig.updateMany({
            where: { isActive: true },
            data: { isActive: false }
        })

        return prisma.salaryConfig.create({
            data: {
                ...data,
                isActive: true
            }
        })
    }
}
