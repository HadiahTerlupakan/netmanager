import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'

interface SiteCreateInput {
    code: string
    name: string
    description?: string | null
    address?: string | null
    latitude?: number | null
    longitude?: number | null
    attendanceRadius?: number
    gudangIds?: string[]
}

interface SiteUpdateInput {
    code?: string
    name?: string
    description?: string | null
    address?: string | null
    latitude?: number | null
    longitude?: number | null
    attendanceRadius?: number
    isActive?: boolean
    gudangIds?: string[]
}

interface SiteFilter {
    search?: string
    activeOnly?: boolean
}

/**
 * Repository for Site data access
 */
export class SiteRepository {
    /**
     * Find all sites with optional filtering
     */
    async findAll(filter?: SiteFilter) {
        const where: Prisma.SitesWhereInput = {}

        if (filter?.activeOnly) {
            where.isActive = true
        }

        if (filter?.search) {
            where.OR = [
                { name: { contains: filter.search, mode: 'insensitive' } },
                { code: { contains: filter.search, mode: 'insensitive' } },
                { address: { contains: filter.search, mode: 'insensitive' } },
            ]
        }

        return prisma.sites.findMany({
            where,
            include: {
                _count: {
                    select: {
                        work_orders: true,
                        user: true,
                    },
                },
            },
            orderBy: { name: 'asc' },
        })
    }

    /**
     * Find site by ID with details
     */
    async findById(id: string) {
        return prisma.sites.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        departments: {
                            select: { name: true },
                        },
                    },
                },
                _count: {
                    select: {
                        work_orders: true,
                    },
                },
                gudang: {
                    select: {
                        id: true,
                        nama: true,
                        kode: true,
                    },
                },
            },
        })
    }

    /**
     * Find site by code
     */
    async findByCode(code: string) {
        return prisma.sites.findUnique({
            where: { code: code.toUpperCase() },
        })
    }

    /**
     * Create new site
     */
    async create(data: SiteCreateInput) {
        return prisma.$transaction(async (tx) => {
            return tx.sites.create({
                data: {
                    id: randomUUID(),
                    code: data.code.toUpperCase(),
                    name: data.name,
                    description: data.description,
                    address: data.address,
                    latitude: data.latitude,
                    longitude: data.longitude,
                    attendanceRadius: data.attendanceRadius || 100,
                    updatedAt: new Date(),
                    gudang: Array.isArray(data.gudangIds) && data.gudangIds.length > 0
                        ? { connect: data.gudangIds.map((id) => ({ id })) }
                        : undefined,
                },
            })
        })
    }

    /**
     * Update site
     */
    async update(id: string, data: SiteUpdateInput) {
        return prisma.$transaction(async (tx) => {
            return tx.sites.update({
                where: { id },
                data: {
                    ...(data.code && { code: data.code.toUpperCase() }),
                    ...(data.name && { name: data.name }),
                    ...(data.description !== undefined && { description: data.description }),
                    ...(data.address !== undefined && { address: data.address }),
                    ...(data.latitude !== undefined && { latitude: data.latitude }),
                    ...(data.longitude !== undefined && { longitude: data.longitude }),
                    ...(data.attendanceRadius !== undefined && { attendanceRadius: data.attendanceRadius }),
                    ...(data.isActive !== undefined && { isActive: data.isActive }),
                    gudang: Array.isArray(data.gudangIds)
                        ? { set: data.gudangIds.map((id) => ({ id })) }
                        : undefined,
                },
            })
        })
    }

    /**
     * Soft delete (deactivate) site
     */
    async deactivate(id: string) {
        return prisma.sites.update({
            where: { id },
            data: { isActive: false },
        })
    }

    /**
     * Hard delete site
     */
    async delete(id: string) {
        return prisma.sites.delete({
            where: { id },
        })
    }

    /**
     * Get site with counts for delete check
     */
    async findWithCounts(id: string) {
        return prisma.sites.findUnique({
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
}
