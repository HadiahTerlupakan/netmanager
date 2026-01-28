import { HargaPaketRepository, HargaPaketCreateInput, HargaPaketUpdateInput, HargaPaketFilterOptions } from '../repositories/HargaPaketRepository'
import { hargaPaketSchema } from '@/lib/validations/hargapaket'
import { sanitizeInput } from '@/lib/utils/sanitize'
import { logger } from '@/lib/logger'

/**
 * Service for HargaPaket business logic
 */
export class HargaPaketService {
    private repository: HargaPaketRepository

    constructor() {
        this.repository = new HargaPaketRepository()
    }

    /**
     * Get all harga pakets with site restriction
     */
    async getAllHargaPakets(options: HargaPaketFilterOptions = {}) {
        return this.repository.findAll(options)
    }

    /**
     * Get harga paket by ID
     */
    async getHargaPaketById(id: string) {
        const hargaPaket = await this.repository.findById(id)
        if (!hargaPaket) {
            throw new Error('Harga paket tidak ditemukan')
        }
        return hargaPaket
    }

    /**
     * Create new harga paket with validation
     */
    async createHargaPaket(data: any, userId?: string) {
        // Sanitize input
        const sanitizedData = {
            ...data,
            name: data.name ? sanitizeInput(data.name) : undefined,
            bandwidthId: data.bandwidthId && data.bandwidthId.trim() ? data.bandwidthId : undefined,
            description: data.description ? sanitizeInput(data.description) : undefined,
        }

        // Validate
        const validation = hargaPaketSchema.safeParse(sanitizedData)
        if (!validation.success) {
            throw {
                code: 'VALIDATION_ERROR',
                message: 'Validation error',
                details: validation.error.flatten(),
            }
        }

        const validData = validation.data

        // Create
        const hargaPaket = await this.repository.create({
            name: validData.name,
            harga: validData.harga,
            durasi: validData.durasi,
            durasiUnit: validData.durasiUnit,
            profilePPPId: validData.profilePPPId,
            bandwidthId: validData.bandwidthId,
            description: validData.description,
            featured: validData.featured,
            status: validData.status,
        })

        // Sync MikroTik rate limit if needed
        await this.syncMikroTikRateLimit(hargaPaket)

        // Log activity
        if (userId) {
            try {
                await logger.logActivity({
                    action: 'CREATE',
                    subject: 'Harga Paket',
                    userId,
                    details: { id: hargaPaket.id, name: hargaPaket.name, price: hargaPaket.harga },
                })
            } catch (e) {
                console.error('[HargaPaketService] Logging failed', e)
            }
        }

        return hargaPaket
    }

    /**
     * Update harga paket
     */
    async updateHargaPaket(id: string, data: any, userId?: string) {
        // Validate exists
        const existing = await this.repository.findById(id)
        if (!existing) {
            throw new Error('Harga paket tidak ditemukan')
        }

        // Sanitize
        const sanitizedData: HargaPaketUpdateInput = {}
        if (data.name !== undefined) sanitizedData.name = sanitizeInput(data.name)
        if (data.harga !== undefined) sanitizedData.harga = data.harga
        if (data.durasi !== undefined) sanitizedData.durasi = data.durasi
        if (data.durasiUnit !== undefined) sanitizedData.durasiUnit = data.durasiUnit
        if (data.profilePPPId !== undefined) sanitizedData.profilePPPId = data.profilePPPId
        if (data.description !== undefined) sanitizedData.description = sanitizeInput(data.description)
        if (data.featured !== undefined) sanitizedData.featured = data.featured
        if (data.status !== undefined) sanitizedData.status = data.status
        
        // Handle bandwidth - can be null to disconnect
        if (data.bandwidthId === null || data.bandwidthId === '') {
            sanitizedData.bandwidthId = null
        } else if (data.bandwidthId) {
            sanitizedData.bandwidthId = data.bandwidthId
        }

        const updated = await this.repository.update(id, sanitizedData)

        // Sync MikroTik if bandwidth changed
        if (data.bandwidthId !== undefined) {
            await this.syncMikroTikRateLimit(updated)
        }

        // Log activity
        if (userId) {
            try {
                await logger.logActivity({
                    action: 'UPDATE',
                    subject: 'Harga Paket',
                    userId,
                    details: { id: updated.id, name: updated.name },
                })
            } catch (e) {
                console.error('[HargaPaketService] Logging failed', e)
            }
        }

        return updated
    }

    /**
     * Delete harga paket
     */
    async deleteHargaPaket(id: string, userId?: string) {
        // Check if exists
        const existing = await this.repository.findById(id)
        if (!existing) {
            throw new Error('Harga paket tidak ditemukan')
        }

        // Check if has pelanggan
        const pelangganCount = await this.repository.countPelangganByHargaPaket(id)
        if (pelangganCount > 0) {
            throw new Error(`Tidak dapat menghapus paket yang masih digunakan oleh ${pelangganCount} pelanggan`)
        }

        await this.repository.delete(id)

        // Log activity
        if (userId) {
            try {
                await logger.logActivity({
                    action: 'DELETE',
                    subject: 'Harga Paket',
                    userId,
                    details: { id, name: existing.name },
                })
            } catch (e) {
                console.error('[HargaPaketService] Logging failed', e)
            }
        }

        return { success: true }
    }

    /**
     * Sync rate limit to MikroTik PPP profile
     */
    private async syncMikroTikRateLimit(hargaPaket: any) {
        if (!hargaPaket.profilePPP?.mikroTikRouterId || !hargaPaket.profilePPP?.mikroTikRouter) {
            return
        }

        try {
            const { getRateLimitFromBandwidth, updatePPPProfileInMikroTik } = await import('@/modules/network/services/mikrotik-ppp-profile')
            const rateLimit = await getRateLimitFromBandwidth(hargaPaket.profilePPP.id)

            if (rateLimit) {
                console.log('[HargaPaketService] Updating rate limit in MikroTik:', rateLimit)
                const updateResult = await updatePPPProfileInMikroTik(
                    hargaPaket.profilePPP.mikroTikRouterId,
                    hargaPaket.profilePPP.name,
                    { rateLimit }
                )

                if (!updateResult.success) {
                    console.error('[HargaPaketService] Failed to update rate limit:', updateResult.error)
                }
            }
        } catch (error) {
            console.error('[HargaPaketService] Error syncing MikroTik:', error)
        }
    }
}
