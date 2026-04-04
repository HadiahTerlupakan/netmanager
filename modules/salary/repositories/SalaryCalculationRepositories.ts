import { prisma } from '@/lib/prisma'
import type { Prisma, EmployeeType, RateType, PtkpStatus } from '@prisma/client'

export interface UserSalaryData {
    id: string
    name: string | null
    basicSalary: number | null
    employeeType: EmployeeType
    departmentId: string | null
    siteId: string | null
    payPeriodDay: number | null
    payDay: number | null
    woIncentiveEnabled: boolean
    woIncentiveRate: number | null
    lateDeductionRate: number | null
    absentDeductionRate: number | null
    overtimeRateNormal: number | null
    overtimeRateHoliday: number | null
    overtimeRateNational: number | null
    overtimeCalcTypeNormal: RateType | null
    overtimeCalcTypeHoliday: RateType | null
    overtimeCalcTypeNational: RateType | null
    workDays: string | null
    joinDate: Date | null
    ptkpStatus: PtkpStatus | null
    bpjsKesehatan: boolean
    bpjsKetenagakerjaan: boolean
}

export class UserRepository {
    async findSalaryData(userId: string): Promise<UserSalaryData | null> {
        return prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                basicSalary: true,
                employeeType: true,
                departmentId: true,
                siteId: true,
                payPeriodDay: true,
                payDay: true,
                woIncentiveEnabled: true,
                woIncentiveRate: true,
                lateDeductionRate: true,
                absentDeductionRate: true,
                overtimeRateNormal: true,
                overtimeRateHoliday: true,
                overtimeRateNational: true,
                overtimeCalcTypeNormal: true,
                overtimeCalcTypeHoliday: true,
                overtimeCalcTypeNational: true,
                workDays: true,
                joinDate: true,
                ptkpStatus: true,
                bpjsKesehatan: true,
                bpjsKetenagakerjaan: true
            }
        }) as Promise<UserSalaryData | null>
    }

    async findManySalaryData(where: Prisma.UserWhereInput): Promise<UserSalaryData[]> {
        return prisma.user.findMany({
            where,
            select: {
                id: true,
                name: true,
                basicSalary: true,
                employeeType: true,
                departmentId: true,
                siteId: true,
                payPeriodDay: true,
                payDay: true,
                woIncentiveEnabled: true,
                woIncentiveRate: true,
                lateDeductionRate: true,
                absentDeductionRate: true,
                overtimeRateNormal: true,
                overtimeRateHoliday: true,
                overtimeRateNational: true,
                overtimeCalcTypeNormal: true,
                overtimeCalcTypeHoliday: true,
                overtimeCalcTypeNational: true,
                workDays: true,
                joinDate: true,
                ptkpStatus: true,
                bpjsKesehatan: true,
                bpjsKetenagakerjaan: true
            }
        }) as Promise<UserSalaryData[]>
    }

    async findActiveUsersWithBasicSalary(filters?: { departmentId?: string; siteId?: string; employeeType?: EmployeeType }) {
        const where: Prisma.UserWhereInput = {
            isActive: true,
            basicSalary: { not: null }
        }
        if (filters?.departmentId) where.departmentId = filters.departmentId
        if (filters?.siteId) where.siteId = filters.siteId
        if (filters?.employeeType) where.employeeType = filters.employeeType

        return this.findManySalaryData(where)
    }

    async findWorkDays(userId: string) {
        return prisma.user.findUnique({
            where: { id: userId },
            select: { workDays: true }
        })
    }
}

export class EmployeeLoanRepository {
    async findActiveByUserId(userId: string) {
        return prisma.employeeLoan.findMany({
            where: { userId, status: 'ACTIVE' }
        })
    }

    async findUnique(id: string) {
        return prisma.employeeLoan.findUnique({ where: { id } })
    }

    async update(id: string, data: Prisma.EmployeeLoanUpdateInput) {
        return prisma.employeeLoan.update({
            where: { id },
            data
        })
    }

    async updateInTransaction(tx: Prisma.TransactionClient, id: string, data: Prisma.EmployeeLoanUpdateInput) {
        return tx.employeeLoan.update({
            where: { id },
            data
        })
    }

    async createLoanPayment(data: Prisma.LoanPaymentCreateInput) {
        return prisma.loanPayment.create({ data })
    }

    async createLoanPaymentInTransaction(tx: Prisma.TransactionClient, data: Prisma.LoanPaymentCreateInput) {
        return tx.loanPayment.create({ data })
    }

    async deleteLoanPayment(id: string) {
        return prisma.loanPayment.delete({ where: { id } })
    }

    async deleteLoanPaymentInTransaction(tx: Prisma.TransactionClient, id: string) {
        return tx.loanPayment.delete({ where: { id } })
    }
}

export class AttendanceRepositoryForSalary {
    async findByUserAndDateRange(userId: string, startDate: Date, endDate: Date) {
        return prisma.attendance.findMany({
            where: {
                userId,
                checkIn: { gte: startDate, lte: endDate }
            },
            select: { status: true }
        })
    }
}

export class OvertimeRepositoryForSalary {
    async findApprovedByUserAndDateRange(userId: string, startDate: Date, endDate: Date) {
        return prisma.overtime.findMany({
            where: {
                userId,
                status: { in: ['APPROVED', 'COMPLETED'] },
                OR: [
                    { startTime: { gte: startDate, lte: endDate } },
                    {
                        AND: [
                            { startTime: null },
                            { createdAt: { gte: startDate, lte: endDate } }
                        ]
                    }
                ]
            },
            select: {
                duration: true,
                isHolidayOvertime: true,
                isNationalHoliday: true
            }
        })
    }
}

export class WorkOrderRepositoryForSalary {
    async countCompletedForUser(userId: string, startDate: Date, endDate: Date) {
        return prisma.workOrders.count({
            where: {
                AND: [
                    {
                        OR: [
                            { assignedToId: userId },
                            { assignments: { some: { userId: userId, status: { not: 'REJECTED' } } } }
                        ]
                    },
                    {
                        OR: [
                            { verifiedAt: { gte: startDate, lte: endDate } },
                            {
                                AND: [
                                    { verifiedAt: null },
                                    { closedAt: { gte: startDate, lte: endDate } }
                                ]
                            }
                        ]
                    }
                ],
                status: { in: ['VERIFIED', 'CLOSED'] }
            }
        })
    }
}

export class SalaryDetailRepository {
    async findManyWithLoanPayment(salaryId: string) {
        return prisma.salaryDetail.findMany({
            where: { salaryId, loanPaymentId: { not: null } },
            include: { loanPayment: true }
        })
    }

    async createWithLoanPayment(data: Prisma.SalaryDetailCreateInput) {
        return prisma.salaryDetail.create({ data })
    }

    async createInTransaction(tx: typeof prisma, data: Prisma.SalaryDetailCreateInput) {
        return tx.salaryDetail.create({ data })
    }
}

export async function runTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn) as Promise<T>
}
