import { LeaveType, LeaveStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type {
    ILeaveRequestRepository,
    ILeaveBalanceRepository,
    LeaveRequestPublic,
    LeaveRequestWithEmployee,
    LeaveRequestCreateData,
    LeaveRequestUpdateData,
    LeaveRequestFilters,
    LeaveBalancePublic,
} from './ILeaveRepository'

export class LeaveRequestRepository implements ILeaveRequestRepository {
    async findAll(filters?: LeaveRequestFilters): Promise<LeaveRequestWithEmployee[]> {
        const where: any = {}

        if (filters) {
            if (filters.employeeId) where.employeeId = filters.employeeId
            if (filters.status) where.status = filters.status
            if (filters.leaveType) where.leaveType = filters.leaveType
            if (filters.startDate && filters.endDate) {
                where.startDate = {
                    gte: filters.startDate,
                    lte: filters.endDate,
                }
            }
        }

        const requests = await prisma.leaveRequest.findMany({
            where,
            include: {
                employee: {
                    select: {
                        id: true,
                        employeeId: true,
                        fullName: true,
                        department: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        })

        return requests as LeaveRequestWithEmployee[]
    }

    async findById(id: string): Promise<LeaveRequestWithEmployee | null> {
        const request = await prisma.leaveRequest.findUnique({
            where: { id },
            include: {
                employee: {
                    select: {
                        id: true,
                        employeeId: true,
                        fullName: true,
                        department: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
            },
        })

        return request as LeaveRequestWithEmployee | null
    }

    async findByEmployee(employeeId: string): Promise<LeaveRequestPublic[]> {
        const requests = await prisma.leaveRequest.findMany({
            where: { employeeId },
            orderBy: { createdAt: 'desc' },
        })

        return requests as LeaveRequestPublic[]
    }

    async findPending(): Promise<LeaveRequestWithEmployee[]> {
        const requests = await prisma.leaveRequest.findMany({
            where: { status: LeaveStatus.PENDING },
            include: {
                employee: {
                    select: {
                        id: true,
                        employeeId: true,
                        fullName: true,
                        department: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        })

        return requests as LeaveRequestWithEmployee[]
    }

    async create(data: LeaveRequestCreateData): Promise<{ id: string }> {
        const request = await prisma.leaveRequest.create({
            data: {
                ...data,
                status: LeaveStatus.PENDING,
            },
            select: { id: true },
        })

        return request
    }

    async update(id: string, data: LeaveRequestUpdateData): Promise<void> {
        await prisma.leaveRequest.update({
            where: { id },
            data,
        })
    }

    async delete(id: string): Promise<void> {
        await prisma.leaveRequest.delete({
            where: { id },
        })
    }

    async count(filters?: LeaveRequestFilters): Promise<number> {
        const where: any = {}

        if (filters) {
            if (filters.employeeId) where.employeeId = filters.employeeId
            if (filters.status) where.status = filters.status
            if (filters.leaveType) where.leaveType = filters.leaveType
        }

        return await prisma.leaveRequest.count({ where })
    }
}

export class LeaveBalanceRepository implements ILeaveBalanceRepository {
    async findByEmployee(employeeId: string, year: number): Promise<LeaveBalancePublic[]> {
        const balances = await prisma.leaveBalance.findMany({
            where: { employeeId, year },
        })

        return balances as LeaveBalancePublic[]
    }

    async findByEmployeeAndType(
        employeeId: string,
        year: number,
        leaveType: LeaveType
    ): Promise<LeaveBalancePublic | null> {
        const balance = await prisma.leaveBalance.findUnique({
            where: {
                employeeId_year_leaveType: {
                    employeeId,
                    year,
                    leaveType,
                },
            },
        })

        return balance as LeaveBalancePublic | null
    }

    async create(data: Omit<LeaveBalancePublic, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ id: string }> {
        const balance = await prisma.leaveBalance.create({
            data,
            select: { id: true },
        })

        return balance
    }

    async update(id: string, data: Partial<LeaveBalancePublic>): Promise<void> {
        await prisma.leaveBalance.update({
            where: { id },
            data,
        })
    }

    async initializeYearlyBalance(employeeId: string, year: number): Promise<void> {
        // Initialize standard leave balances for the year
        const defaultBalances = [
            { leaveType: LeaveType.ANNUAL, totalDays: 12 }, // 12 hari cuti tahunan
            { leaveType: LeaveType.SICK, totalDays: 12 }, // 12 hari sakit
        ]

        for (const { leaveType, totalDays } of defaultBalances) {
            // Check if already exists
            const existing = await this.findByEmployeeAndType(employeeId, year, leaveType)

            if (!existing) {
                await this.create({
                    employeeId,
                    year,
                    leaveType,
                    totalDays,
                    usedDays: 0,
                    remainingDays: totalDays,
                })
            }
        }
    }
}
