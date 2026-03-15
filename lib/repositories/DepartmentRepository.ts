import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import type {
    IDepartmentRepository,
    DepartmentPublic,
    DepartmentWithUserCount,
    DepartmentCreateData,
    DepartmentUpdateData,
} from './IDepartmentRepository'

export class DepartmentRepository implements IDepartmentRepository {
    async findAll(): Promise<DepartmentWithUserCount[]> {
        const departments = await prisma.departments.findMany({
            include: {
                _count: {
                    select: { user: true },
                },
            },
            orderBy: { name: 'asc' },
        })

        return departments
    }

    async findById(id: string): Promise<DepartmentPublic | null> {
        const department = await prisma.departments.findUnique({
            where: { id },
        })

        return department
    }

    async findByName(name: string): Promise<DepartmentPublic | null> {
        const department = await prisma.departments.findFirst({
            where: { name },
        })

        return department
    }

    async create(data: DepartmentCreateData): Promise<{ id: string }> {
        const department = await prisma.departments.create({
            data: {
                id: randomUUID(),
                ...data,
                updatedAt: new Date(),
            },
            select: { id: true },
        })

        return department
    }

    async update(id: string, data: DepartmentUpdateData): Promise<void> {
        await prisma.departments.update({
            where: { id },
            data: {
                ...data,
                updatedAt: new Date(),
            },
        })
    }

    async delete(id: string): Promise<void> {
        await prisma.departments.delete({
            where: { id },
        })
    }

    async count(): Promise<number> {
        return await prisma.departments.count()
    }
}
