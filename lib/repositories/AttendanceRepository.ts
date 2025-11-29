import { PrismaClient, AttendanceStatus } from '@prisma/client'
import type {
    IAttendanceRepository,
    AttendancePublic,
    AttendanceWithEmployee,
    AttendanceCreateData,
    AttendanceCheckOutData,
    AttendanceUpdateData,
    AttendanceFilters,
} from './IAttendanceRepository'

const prisma = new PrismaClient()

export class AttendanceRepository implements IAttendanceRepository {
    async findAll(filters?: AttendanceFilters): Promise<AttendanceWithEmployee[]> {
        const where: any = {}

        if (filters) {
            if (filters.employeeId) where.employeeId = filters.employeeId
            if (filters.status) where.status = filters.status
            if (filters.startDate && filters.endDate) {
                where.date = {
                    gte: filters.startDate,
                    lte: filters.endDate,
                }
            }
            if (filters.departmentId) {
                where.employee = {
                    departmentId: filters.departmentId,
                }
            }
        }

        const attendances = await prisma.attendance.findMany({
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
                date: 'desc',
            },
        })

        return attendances as AttendanceWithEmployee[]
    }

    async findById(id: string): Promise<AttendanceWithEmployee | null> {
        const attendance = await prisma.attendance.findUnique({
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

        return attendance as AttendanceWithEmployee | null
    }

    async findByEmployeeAndDate(employeeId: string, date: Date): Promise<AttendancePublic | null> {
        // Normalize date to start of day
        const startOfDay = new Date(date)
        startOfDay.setHours(0, 0, 0, 0)

        const attendance = await prisma.attendance.findUnique({
            where: {
                employeeId_date: {
                    employeeId,
                    date: startOfDay,
                },
            },
        })

        return attendance as AttendancePublic | null
    }

    async findByEmployee(employeeId: string, startDate?: Date, endDate?: Date): Promise<AttendancePublic[]> {
        const where: any = { employeeId }

        if (startDate && endDate) {
            where.date = {
                gte: startDate,
                lte: endDate,
            }
        }

        const attendances = await prisma.attendance.findMany({
            where,
            orderBy: { date: 'desc' },
        })

        return attendances as AttendancePublic[]
    }

    async findByDate(date: Date): Promise<AttendanceWithEmployee[]> {
        const startOfDay = new Date(date)
        startOfDay.setHours(0, 0, 0, 0)

        const attendances = await prisma.attendance.findMany({
            where: { date: startOfDay },
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
            orderBy: { employee: { fullName: 'asc' } },
        })

        return attendances as AttendanceWithEmployee[]
    }

    async findByDateRange(startDate: Date, endDate: Date): Promise<AttendanceWithEmployee[]> {
        const attendances = await prisma.attendance.findMany({
            where: {
                date: {
                    gte: startDate,
                    lte: endDate,
                },
            },
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
            orderBy: { date: 'desc' },
        })

        return attendances as AttendanceWithEmployee[]
    }

    async create(data: AttendanceCreateData): Promise<{ id: string }> {
        // Normalize date
        const normalizedDate = new Date(data.date)
        normalizedDate.setHours(0, 0, 0, 0)

        const attendance = await prisma.attendance.create({
            data: {
                ...data,
                date: normalizedDate,
                status: data.status || AttendanceStatus.PRESENT,
            },
            select: { id: true },
        })

        return attendance
    }

    async checkOut(id: string, data: AttendanceCheckOutData): Promise<void> {
        await prisma.attendance.update({
            where: { id },
            data,
        })
    }

    async update(id: string, data: AttendanceUpdateData): Promise<void> {
        await prisma.attendance.update({
            where: { id },
            data,
        })
    }

    async delete(id: string): Promise<void> {
        await prisma.attendance.delete({
            where: { id },
        })
    }

    async count(filters?: AttendanceFilters): Promise<number> {
        const where: any = {}

        if (filters) {
            if (filters.employeeId) where.employeeId = filters.employeeId
            if (filters.status) where.status = filters.status
            if (filters.startDate && filters.endDate) {
                where.date = {
                    gte: filters.startDate,
                    lte: filters.endDate,
                }
            }
        }

        return await prisma.attendance.count({ where })
    }

    async getSummary(date: Date): Promise<{ present: number; late: number; absent: number; leave: number }> {
        const startOfDay = new Date(date)
        startOfDay.setHours(0, 0, 0, 0)

        const [present, late, absent, leave] = await Promise.all([
            prisma.attendance.count({ where: { date: startOfDay, status: AttendanceStatus.PRESENT } }),
            prisma.attendance.count({ where: { date: startOfDay, status: AttendanceStatus.LATE } }),
            prisma.attendance.count({ where: { date: startOfDay, status: AttendanceStatus.ABSENT } }),
            prisma.attendance.count({ where: { date: startOfDay, status: AttendanceStatus.LEAVE } }),
        ])

        return { present, late, absent, leave }
    }
}
