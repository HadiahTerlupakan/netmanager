import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'

export class DepartmentRepository {
    async findAll(filters: { search?: string, reminderOnly?: boolean } = {}): Promise<unknown[]> {
        const where: Prisma.DepartmentsWhereInput = {}

        if (filters.search) {
            where.OR = [
                { name: { contains: filters.search, mode: 'insensitive' } },
                { description: { contains: filters.search, mode: 'insensitive' } },
            ]
        }

        if (filters.reminderOnly) {
            where.isReminderTarget = true
        }

        return prisma.departments.findMany({
            where,
            include: {
                _count: {
                    select: {
                        user: true,
                        work_orders: true,
                    },
                },
            },
            orderBy: { name: 'asc' },
        })
    }

    async findById(id: string): Promise<unknown> {
        return prisma.departments.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                    take: 10,
                },
                _count: {
                    select: {
                        user: true,
                        work_orders: true,
                    },
                },
            },
        })
    }

    async findByName(name: string): Promise<unknown> {
        return prisma.departments.findFirst({
            where: { name },
        })
    }

    async create(data: {
        id: string,
        name: string,
        description?: string | null,
        jobDescription?: string | null,
        isReminderTarget?: boolean,
        showInMobileWO?: boolean,
        updatedAt: Date,
    }): Promise<unknown> {
        return prisma.departments.create({
            data: {
                id: data.id || randomUUID(),
                name: data.name,
                description: data.description || null,
                jobDescription: data.jobDescription || null,
                isReminderTarget: data.isReminderTarget ?? false,
                showInMobileWO: data.showInMobileWO ?? false,
                updatedAt: data.updatedAt || new Date(),
            },
        })
    }

    async update(id: string, data: Record<string, unknown>): Promise<unknown> {
        return prisma.departments.update({
            where: { id },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.description !== undefined && { description: data.description || null }),
                ...(data.jobDescription !== undefined && { jobDescription: data.jobDescription || null }),
                ...(data.isReminderTarget !== undefined && { isReminderTarget: data.isReminderTarget }),
                ...(data.showInMobileWO !== undefined && { showInMobileWO: data.showInMobileWO }),
            },
        })
    }

    async findByIdWithCounts(id: string): Promise<{ _count: { user: number, work_orders: number } } | null> {
        return prisma.departments.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        user: true,
                        work_orders: true,
                    },
                },
            },
        })
    }

    async delete(id: string): Promise<void> {
        await prisma.departments.delete({
            where: { id },
        })
    }
}
