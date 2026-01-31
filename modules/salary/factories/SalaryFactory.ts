/**
 * SalaryFactory
 *
 * Factory pattern for creating Salary with different configurations.
 */

import { prisma } from '@/lib/prisma'

export interface CreateSalaryInput {
    userId: string
    month: number
    year: number
    basicSalary: number
    totalEarnings?: number
    totalDeductions?: number
    netSalary?: number
}

export class SalaryFactory {
    /**
     * Create salary input for a specific period
     */
    static async createForPeriod(dto: {
        userId: string
        month: number
        year: number
    }): Promise<CreateSalaryInput> {
        // Fetch user's basic salary from their salary components
        const userComponents = await prisma.userSalaryComponent.findMany({
            where: {
                userId: dto.userId,
                isActive: true,
                component: {
                    type: 'EARNING',
                    name: 'Gaji Pokok',
                }
            },
            include: {
                component: true,
            }
        })

        // Default basic salary from user components or default
        const basicSalary = userComponents.length > 0
            ? userComponents[0].amount
            : 0

        return {
            userId: dto.userId,
            month: dto.month,
            year: dto.year,
            basicSalary,
            totalEarnings: 0,
            totalDeductions: 0,
            netSalary: 0,
        }
    }

    /**
     * Create bulk salaries for all active employees
     */
    static async createBulkForPeriod(dto: {
        month: number
        year: number
        userIds?: string[]
    }): Promise<CreateSalaryInput[]> {
        // Get active employees
        const whereClause: { isActive: boolean; id?: { in: string[] } } = { isActive: true }
        if (dto.userIds && dto.userIds.length > 0) {
            whereClause.id = { in: dto.userIds }
        }

        const users = await prisma.user.findMany({
            where: whereClause,
            select: {
                id: true,
                userSalaryComponents: {
                    where: {
                        isActive: true,
                        component: {
                            name: 'Gaji Pokok',
                        }
                    },
                    select: {
                        amount: true,
                    }
                }
            }
        })

        return users.map(user => ({
            userId: user.id,
            month: dto.month,
            year: dto.year,
            basicSalary: user.userSalaryComponents[0]?.amount ?? 0,
            totalEarnings: 0,
            totalDeductions: 0,
            netSalary: 0,
        }))
    }

    /**
     * Calculate salary details based on attendance, overtime, etc.
     */
    static async calculateDetails(salaryId: string): Promise<{
        totalEarnings: number
        totalDeductions: number
        netSalary: number
    }> {
        const salary = await prisma.salary.findUnique({
            where: { id: salaryId },
            include: {
                details: true,
            }
        })

        if (!salary) {
            throw new Error('Salary not found')
        }

        let totalEarnings = salary.basicSalary
        let totalDeductions = 0

        for (const detail of salary.details) {
            if (detail.type === 'EARNING') {
                totalEarnings += detail.amount
            } else if (detail.type === 'DEDUCTION') {
                totalDeductions += detail.amount
            }
        }

        const netSalary = totalEarnings - totalDeductions

        return {
            totalEarnings,
            totalDeductions,
            netSalary,
        }
    }
}
