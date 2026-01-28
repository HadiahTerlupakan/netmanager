import { prisma } from '@/lib/prisma'
import { Prisma, Status } from '@prisma/client'

export interface HargaPaketCreateInput {
    name: string
    harga: number
    durasi: number
    durasiUnit?: string
    profilePPPId: string
    bandwidthId?: string
    description?: string
    featured?: boolean
    status?: Status
}

export interface HargaPaketUpdateInput {
    name?: string
    harga?: number
    durasi?: number
    durasiUnit?: string
    profilePPPId?: string
    bandwidthId?: string | null
    description?: string
    featured?: boolean
    status?: Status
}

export interface HargaPaketFilterOptions {
    status?: string
    featured?: boolean
    siteId?: string
}

/**
 * Repository for HargaPaket (pricing package) operations
 */
export class HargaPaketRepository {
    /**
     * Get all harga pakets with filters
     */
    async findAll(options: HargaPaketFilterOptions = {}) {
        const where: Prisma.HargaPaketWhereInput = {}

        if (options.status) {
            where.status = options.status as Status
        }
        if (options.featured !== undefined) {
            where.featured = options.featured
        }
        if (options.siteId) {
            where.profilePPP = {
                mikroTikRouter: {
                    siteId: options.siteId
                }
            }
        }

        return prisma.hargaPaket.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                bandwidth: true,
                profilePPP: true,
            },
        })
    }

    /**
     * Get harga paket by ID
     */
    async findById(id: string) {
        return prisma.hargaPaket.findUnique({
            where: { id },
            include: {
                bandwidth: true,
                profilePPP: {
                    include: {
                        mikroTikRouter: true,
                    },
                },
            },
        })
    }

    /**
     * Create new harga paket
     */
    async create(data: HargaPaketCreateInput) {
        const createData: any = {
            id: crypto.randomUUID(),
            updatedAt: new Date(),
            name: data.name,
            harga: data.harga,
            durasi: data.durasi,
            durasiUnit: data.durasiUnit || 'BULAN',
            profilePPPId: data.profilePPPId,
            description: data.description,
            featured: data.featured ?? false,
            status: data.status || 'AKTIF',
        }

        if (data.bandwidthId && data.bandwidthId.trim() !== '') {
            createData.bandwidthId = data.bandwidthId
        }

        return prisma.hargaPaket.create({
            data: createData,
            include: {
                bandwidth: true,
                profilePPP: {
                    include: {
                        mikroTikRouter: true,
                    },
                },
            },
        })
    }

    /**
     * Update harga paket
     */
    async update(id: string, data: HargaPaketUpdateInput) {
        const updateData: any = {
            updatedAt: new Date(),
        }

        if (data.name !== undefined) updateData.name = data.name
        if (data.harga !== undefined) updateData.harga = data.harga
        if (data.durasi !== undefined) updateData.durasi = data.durasi
        if (data.durasiUnit !== undefined) updateData.durasiUnit = data.durasiUnit
        if (data.profilePPPId !== undefined) updateData.profilePPPId = data.profilePPPId
        if (data.description !== undefined) updateData.description = data.description
        if (data.featured !== undefined) updateData.featured = data.featured
        if (data.status !== undefined) updateData.status = data.status
        
        // Handle optional bandwidth
        if (data.bandwidthId === null) {
            updateData.bandwidthId = null
        } else if (data.bandwidthId && data.bandwidthId.trim() !== '') {
            updateData.bandwidthId = data.bandwidthId
        }

        return prisma.hargaPaket.update({
            where: { id },
            data: updateData,
            include: {
                bandwidth: true,
                profilePPP: {
                    include: {
                        mikroTikRouter: true,
                    },
                },
            },
        })
    }

    /**
     * Delete harga paket
     */
    async delete(id: string) {
        return prisma.hargaPaket.delete({
            where: { id },
        })
    }

    /**
     * Check if name exists (for unique constraint)
     */
    async existsByName(name: string, excludeId?: string): Promise<boolean> {
        const existing = await prisma.hargaPaket.findFirst({
            where: {
                name,
                ...(excludeId && { id: { not: excludeId } }),
            },
        })
        return existing !== null
    }

    /**
     * Count pelanggan using this harga paket
     */
    async countPelangganByHargaPaket(hargaPaketId: string): Promise<number> {
        return prisma.pelanggan.count({
            where: { hargaPaketId },
        })
    }
}
