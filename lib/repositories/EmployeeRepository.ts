import { prisma } from '@/lib/prisma'
import type {
    IEmployeeRepository,
    EmployeePublic,
    EmployeeWithRelations,
    EmployeeCreateData,
    EmployeeUpdateData,
    EmployeeFilters,
} from './IEmployeeRepository'

export class EmployeeRepository implements IEmployeeRepository {
    async findAll(filters?: EmployeeFilters): Promise<EmployeeWithRelations[]> {
        const where: any = {}

        if (filters) {
            if (filters.departmentId) where.departmentId = filters.departmentId
            if (filters.positionId) where.positionId = filters.positionId
            if (filters.employmentStatus) where.employmentStatus = filters.employmentStatus
            if (filters.isActive !== undefined) where.isActive = filters.isActive
            if (filters.search) {
                where.OR = [
                    { fullName: { contains: filters.search, mode: 'insensitive' } },
                    { email: { contains: filters.search, mode: 'insensitive' } },
                    { employeeId: { contains: filters.search, mode: 'insensitive' } },
                ]
            }
        }

        const employees = await prisma.employee.findMany({
            where,
            include: {
                department: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                position: {
                    select: {
                        id: true,
                        title: true,
                        level: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        })

        return employees as EmployeeWithRelations[]
    }

    async findById(id: string): Promise<EmployeeWithRelations | null> {
        const employee = await prisma.employee.findUnique({
            where: { id },
            include: {
                department: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                position: {
                    select: {
                        id: true,
                        title: true,
                        level: true,
                    },
                },
            },
        })

        return employee as EmployeeWithRelations | null
    }

    async findByEmployeeId(employeeId: string): Promise<EmployeeWithRelations | null> {
        const employee = await prisma.employee.findUnique({
            where: { employeeId },
            include: {
                department: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                    },
                },
                position: {
                    select: {
                        id: true,
                        title: true,
                        level: true,
                    },
                },
            },
        })

        return employee as EmployeeWithRelations | null
    }

    async findByUserId(userId: string): Promise<EmployeePublic | null> {
        const employee = await prisma.employee.findUnique({
            where: { userId },
        })

        return employee as EmployeePublic | null
    }

    async findByEmail(email: string): Promise<EmployeePublic | null> {
        const employee = await prisma.employee.findUnique({
            where: { email },
        })

        return employee as EmployeePublic | null
    }

    async findByDepartment(departmentId: string): Promise<EmployeePublic[]> {
        const employees = await prisma.employee.findMany({
            where: { departmentId, isActive: true },
            orderBy: { fullName: 'asc' },
        })

        return employees as EmployeePublic[]
    }

    async findByPosition(positionId: string): Promise<EmployeePublic[]> {
        const employees = await prisma.employee.findMany({
            where: { positionId, isActive: true },
            orderBy: { fullName: 'asc' },
        })

        return employees as EmployeePublic[]
    }

    async findByManager(managerId: string): Promise<EmployeePublic[]> {
        const employees = await prisma.employee.findMany({
            where: { managerId, isActive: true },
            orderBy: { fullName: 'asc' },
        })

        return employees as EmployeePublic[]
    }

    async findActiveEmployees(): Promise<EmployeePublic[]> {
        const employees = await prisma.employee.findMany({
            where: { isActive: true },
            orderBy: { fullName: 'asc' },
        })

        return employees as EmployeePublic[]
    }

    async create(data: EmployeeCreateData): Promise<{ id: string }> {
        const employee = await prisma.employee.create({
            data,
            select: { id: true },
        })

        return employee
    }

    async update(id: string, data: EmployeeUpdateData): Promise<void> {
        await prisma.employee.update({
            where: { id },
            data,
        })
    }

    async delete(id: string): Promise<void> {
        await prisma.employee.delete({
            where: { id },
        })
    }

    async count(filters?: EmployeeFilters): Promise<number> {
        const where: any = {}

        if (filters) {
            if (filters.departmentId) where.departmentId = filters.departmentId
            if (filters.positionId) where.positionId = filters.positionId
            if (filters.employmentStatus) where.employmentStatus = filters.employmentStatus
            if (filters.isActive !== undefined) where.isActive = filters.isActive
            if (filters.search) {
                where.OR = [
                    { fullName: { contains: filters.search, mode: 'insensitive' } },
                    { email: { contains: filters.search, mode: 'insensitive' } },
                    { employeeId: { contains: filters.search, mode: 'insensitive' } },
                ]
            }
        }

        return await prisma.employee.count({ where })
    }

    async countByStatus(status: any): Promise<number> {
        return await prisma.employee.count({
            where: { employmentStatus: status },
        })
    }

    async countByDepartment(departmentId: string): Promise<number> {
        return await prisma.employee.count({
            where: { departmentId, isActive: true },
        })
    }
}
