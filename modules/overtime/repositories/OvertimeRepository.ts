import { prisma } from '@/lib/prisma'
import { IOvertimeRepository } from './IOvertimeRepository'
import { Overtime, OvertimeStatus, Prisma } from '@prisma/client'

export class OvertimeRepository implements IOvertimeRepository {
    async findById(id: string): Promise<Overtime | null> {
        return prisma.overtime.findUnique({
            where: { id },
            include: {
                user: true,
                attendance: true,
            },
        })
    }

    async findAll(filters?: {
        userId?: string
        status?: OvertimeStatus
        startDate?: Date
        endDate?: Date
    }): Promise<Overtime[]> {
        const where: Prisma.OvertimeWhereInput = {}

        if (filters?.userId) {
            where.userId = filters.userId
        }

        if (filters?.status) {
            where.status = filters.status
        }

        if (filters?.startDate && filters?.endDate) {
            where.createdAt = {
                gte: filters.startDate,
                lte: filters.endDate,
            }
        }

        return prisma.overtime.findMany({
            where,
            orderBy: {
                createdAt: 'desc',
            },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true,
                        image: true,
                        site: {
                            select: {
                                name: true
                            }
                        }
                    }
                },
                attendance: true,
            },
        })
    }

    async create(data: Prisma.OvertimeCreateInput): Promise<Overtime> {
        return prisma.overtime.create({
            data,
        })
    }

    async update(id: string, data: Prisma.OvertimeUpdateInput): Promise<Overtime> {
        return prisma.overtime.update({
            where: { id },
            data,
        })
    }

    async delete(id: string): Promise<void> {
        await prisma.overtime.delete({
            where: { id },
        })
    }
}
