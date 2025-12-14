import { prisma } from '@/lib/prisma'
import type {
    IDepartmentRepository,
    DepartmentPublic,
    DepartmentWithEmployeeCount,
    DepartmentCreateData,
    DepartmentUpdateData,
} from './IDepartmentRepository'

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
