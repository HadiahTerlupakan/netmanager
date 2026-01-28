import { SiteRepository } from '../repositories/SiteRepository'
import { logger } from '@/lib/logger'

interface SiteCreateInput {
    code: string
    name: string
    description?: string | null
    address?: string | null
    latitude?: string | number | null
    longitude?: string | number | null
    attendanceRadius?: string | number
    gudangIds?: string[]
}

interface SiteUpdateInput {
    code?: string
    name?: string
    description?: string | null
    address?: string | null
    latitude?: string | number | null
    longitude?: string | number | null
    attendanceRadius?: string | number
    isActive?: boolean
    gudangIds?: string[]
}

/**
 * Service for Site business logic
 */
export class SiteService {
    private repository: SiteRepository

    constructor() {
        this.repository = new SiteRepository()
    }

    /**
     * Get all sites with optional filtering
     */
    async getSites(options?: { search?: string; activeOnly?: boolean }) {
        return this.repository.findAll(options)
    }

    /**
     * Get site by ID
     */
    async getSiteById(id: string) {
        const site = await this.repository.findById(id)
        if (!site) {
            throw new Error('Site not found')
        }
        return site
    }

    /**
     * Create new site
     */
    async createSite(data: SiteCreateInput, userId: string) {
        // Validate required fields
        if (!data.code || !data.name) {
            throw new Error('Code and name are required')
        }

        // Check for duplicate code
        const existing = await this.repository.findByCode(data.code)
        if (existing) {
            throw new Error('Site code already exists')
        }

        // Prepare data with type conversions
        const createData = {
            code: data.code,
            name: data.name,
            description: data.description,
            address: data.address,
            latitude: data.latitude ? parseFloat(String(data.latitude)) : null,
            longitude: data.longitude ? parseFloat(String(data.longitude)) : null,
            attendanceRadius: data.attendanceRadius ? parseInt(String(data.attendanceRadius)) : 100,
            gudangIds: data.gudangIds,
        }

        const site = await this.repository.create(createData)

        // Log activity
        try {
            await logger.logActivity({
                action: 'CREATE',
                subject: 'Site',
                userId,
                details: {
                    id: site.id,
                    name: site.name,
                    code: site.code,
                    assignedGudangs: data.gudangIds?.length || 0,
                },
            })
        } catch (e) {
            console.error('Logging failed', e)
        }

        return site
    }

    /**
     * Update site
     */
    async updateSite(id: string, data: SiteUpdateInput, userId: string) {
        // Check if site exists
        const existing = await this.repository.findById(id)
        if (!existing) {
            throw new Error('Site not found')
        }

        // If updating code, check for duplicates
        if (data.code && data.code.toUpperCase() !== existing.code) {
            const duplicate = await this.repository.findByCode(data.code)
            if (duplicate) {
                throw new Error('Site code already exists')
            }
        }

        // Prepare data with type conversions
        const updateData = {
            code: data.code,
            name: data.name,
            description: data.description,
            address: data.address,
            latitude: data.latitude !== undefined ? (data.latitude ? parseFloat(String(data.latitude)) : null) : undefined,
            longitude: data.longitude !== undefined ? (data.longitude ? parseFloat(String(data.longitude)) : null) : undefined,
            attendanceRadius: data.attendanceRadius !== undefined ? parseInt(String(data.attendanceRadius)) : undefined,
            isActive: data.isActive,
            gudangIds: data.gudangIds,
        }

        const site = await this.repository.update(id, updateData)

        // Log activity
        try {
            await logger.logActivity({
                action: 'UPDATE',
                subject: 'Site',
                userId,
                details: {
                    id: site.id,
                    updates: { ...data, gudangIdsCount: Array.isArray(data.gudangIds) ? data.gudangIds.length : 'unchanged' },
                },
            })
        } catch (e) {
            console.error('Logging failed', e)
        }

        return site
    }

    /**
     * Delete site (soft or hard based on associations)
     */
    async deleteSite(id: string, userId: string) {
        const site = await this.repository.findWithCounts(id)
        if (!site) {
            throw new Error('Site not found')
        }

        const hasAssociations = site._count.user > 0 || site._count.work_orders > 0

        if (hasAssociations) {
            // Soft delete - deactivate
            await this.repository.deactivate(id)

            try {
                await logger.logActivity({
                    action: 'UPDATE',
                    subject: 'Site',
                    userId,
                    details: { id: site.id, name: site.name, status: 'DEACTIVATED' },
                })
            } catch (e) {
                console.error('Logging failed', e)
            }

            return { softDeleted: true, message: 'Site deactivated (has associated users/work orders)' }
        }

        // Hard delete
        await this.repository.delete(id)

        try {
            await logger.logActivity({
                action: 'DELETE',
                subject: 'Site',
                userId,
                details: { id: site.id, name: site.name },
            })
        } catch (e) {
            console.error('Logging failed', e)
        }

        return { softDeleted: false, message: 'Site deleted successfully' }
    }
}
