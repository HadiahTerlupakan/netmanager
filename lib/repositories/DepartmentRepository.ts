import { prisma } from '@/lib/prisma'
import type {
    IDepartmentRepository,
    DepartmentPublic,
    DepartmentWithEmployeeCount,
    DepartmentCreateData,
    DepartmentUpdateData,
} from './IDepartmentRepository'

export interface DepartmentWithRoles extends DepartmentWithEmployeeCount {
    roles: Array<{
        id: string
        name: string
        code: string
        priority: number
        allowedFeatures: string | null
        isActive: boolean
        _count: {
            employeeRoles: number
        }
    }>
}

export class DepartmentRepository implements IDepartmentRepository {
    async findAll(): Promise<DepartmentWithEmployeeCount[]> {
        const departments = await prisma.department.findMany({
            include: {
                _count: {
                    select: { employees: true },
                },
            },
            orderBy: { name: 'asc' },
        })

        return departments
    }

    async findAllWithRoles(): Promise<DepartmentWithRoles[]> {
        const departments = await prisma.department.findMany({
            include: {
                _count: {
                    select: { employees: true },
                },
                customRoles: {
                    include: {
                        _count: {
                            select: { employeeRoles: true },
                        },
                    },
                    orderBy: { priority: 'desc' },
                },
            },
            orderBy: { name: 'asc' },
        })

        // Transform departments to match DepartmentWithRoles interface
        return departments.map(dept => {
            const { customRoles, ...deptWithoutRoles } = dept
            return {
                ...deptWithoutRoles,
                roles: customRoles.map(role => ({
                    id: role.id,
                    name: role.name,
                    code: role.code,
                    priority: role.priority,
                    allowedFeatures: role.allowedFeatures,
                    isActive: role.isActive,
                    _count: role._count
                }))
            } as DepartmentWithRoles
        })
    }

    async findById(id: string): Promise<DepartmentPublic | null> {
        const department = await prisma.department.findUnique({
            where: { id },
        })

        return department
    }

    async findByName(name: string): Promise<DepartmentPublic | null> {
        const department = await prisma.department.findUnique({
            where: { name },
        })

        return department
    }

    async create(data: DepartmentCreateData): Promise<{ id: string }> {
        const department = await prisma.department.create({
            data,
            select: { id: true },
        })

        return department
    }

    async update(id: string, data: DepartmentUpdateData): Promise<void> {
        await prisma.department.update({
            where: { id },
            data,
        })
    }

    async delete(id: string): Promise<void> {
        await prisma.department.delete({
            where: { id },
        })
    }

    async count(): Promise<number> {
        return await prisma.department.count()
    }
}
