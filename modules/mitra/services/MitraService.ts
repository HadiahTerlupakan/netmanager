import { prisma } from '@/lib/prisma'
import { hash } from 'bcryptjs'
import { logger, logActivitySafe } from '@/lib/logger'
import { MitraRepository, getMitraRepository } from '../repositories/MitraRepository'
import type { CreateMitraDTO, UpdateMitraDTO, MitraFilters } from '../dto/MitraDTO'

interface ServiceResult<T = void> {
    success: boolean
    data?: T
    error?: string
}

export class MitraService {
    private repository: MitraRepository

    constructor() {
        this.repository = getMitraRepository()
    }

    /**
     * Get all mitra with filters and pagination
     */
    async getMitras(filters: MitraFilters, page: number = 1, limit: number = 20) {
        try {
            const result = await this.repository.findAll(filters, page, limit)
            const stats = await this.repository.getStats()
            return { success: true, data: { ...result, stats } }
        } catch (error) {
            logger.error('[MitraService] Error fetching mitras:', error as Error)
            return { success: false, error: 'Gagal mengambil data mitra' }
        }
    }

    /**
     * Get single mitra by ID
     */
    async getMitraById(id: string): Promise<ServiceResult<Record<string, unknown>>> {
        try {
            const mitra = await this.repository.findById(id)
            if (!mitra) {
                return { success: false, error: 'Mitra tidak ditemukan' }
            }
            return { success: true, data: mitra }
        } catch (error) {
            logger.error('[MitraService] Error fetching mitra:', error as Error)
            return { success: false, error: 'Gagal mengambil data mitra' }
        }
    }

    /**
     * Create new mitra user with wallet
     */
    async createMitra(data: CreateMitraDTO, createdById: string): Promise<ServiceResult<{ id: string }>> {
        try {
            // Check if email already exists
            const existing = await prisma.mitra.findUnique({ where: { email: data.email } })
            if (existing) {
                return { success: false, error: 'Email sudah digunakan' }
            }

            // Validate mitra type (mapped from DTO employeeType temporarily, ideally DTO also updated)
            const mitraType = data.employeeType === 'MITRA_SALES' ? 'MITRA_SALES' : 'MITRA_TEKNISI';

            const passwordHash = await hash(data.password, 12)
            const id = crypto.randomUUID()

            // Create user + wallet in transaction
            await prisma.$transaction(async (tx) => {
                // Create the mitra user
                await tx.mitra.create({
                    data: {
                        id,
                        name: data.name,
                        email: data.email,
                        passwordHash,
                        phone: data.phone,
                        mitraType,
                        siteId: data.siteId,
                        mitraRateWo: data.mitraRateWo,
                        mitraRateCanvasing: data.mitraRateCanvasing,
                        bankName: data.bankName,
                        bankAccountNo: data.bankAccountNo,
                        bankAccountName: data.bankAccountName,
                        isActive: true,
                    },
                })

                // Create wallet automatically
                await tx.mitraWallet.create({
                    data: { mitraId: id },
                })
            })

            logActivitySafe({
                action: 'CREATE',
                subject: 'Mitra',
                userId: createdById,
                details: { mitraId: id, name: data.name, type: data.employeeType },
            })

            return { success: true, data: { id } }
        } catch (error) {
            logger.error('[MitraService] Error creating mitra:', error as Error)
            return { success: false, error: 'Gagal membuat mitra' }
        }
    }

    /**
     * Update mitra user
     */
    async updateMitra(id: string, data: UpdateMitraDTO, updatedById: string): Promise<ServiceResult> {
        try {
            const existing = await prisma.mitra.findUnique({ where: { id } })
            if (!existing) {
                return { success: false, error: 'Mitra tidak ditemukan' }
            }

            // Check email uniqueness if changing
            if (data.email && data.email !== existing.email) {
                const emailTaken = await prisma.mitra.findUnique({ where: { email: data.email } })
                if (emailTaken) {
                    return { success: false, error: 'Email sudah digunakan' }
                }
            }

            const mitraType = data.employeeType === 'MITRA_SALES' ? 'MITRA_SALES' : (data.employeeType === 'MITRA_TEKNISI' ? 'MITRA_TEKNISI' : undefined);

            await prisma.mitra.update({
                where: { id },
                data: {
                    ...(data.name && { name: data.name }),
                    ...(data.email && { email: data.email }),
                    ...(data.phone !== undefined && { phone: data.phone }),
                    ...(mitraType && { mitraType }),
                    ...(data.siteId !== undefined && { siteId: data.siteId }),
                    ...(data.mitraRateWo !== undefined && { mitraRateWo: data.mitraRateWo }),
                    ...(data.mitraRateCanvasing !== undefined && { mitraRateCanvasing: data.mitraRateCanvasing }),
                    ...(data.bankName !== undefined && { bankName: data.bankName }),
                    ...(data.bankAccountNo !== undefined && { bankAccountNo: data.bankAccountNo }),
                    ...(data.bankAccountName !== undefined && { bankAccountName: data.bankAccountName }),
                    ...(data.isActive !== undefined && { isActive: data.isActive }),
                },
            })

            // Ensure wallet exists
            const wallet = await prisma.mitraWallet.findUnique({ where: { mitraId: id } })
            if (!wallet) {
                await prisma.mitraWallet.create({ data: { mitraId: id } })
            }

            logActivitySafe({
                action: 'UPDATE',
                subject: 'Mitra',
                userId: updatedById,
                details: { mitraId: id, changes: data as unknown as Record<string, unknown> },
            })

            return { success: true }
        } catch (error) {
            logger.error('[MitraService] Error updating mitra:', error as Error)
            return { success: false, error: 'Gagal memperbarui mitra' }
        }
    }

    /**
     * Delete mitra (soft delete — set isActive = false)
     */
    async deleteMitra(id: string, deletedById: string): Promise<ServiceResult> {
        try {
            await prisma.mitra.update({
                where: { id },
                data: { isActive: false },
            })

            logActivitySafe({ action: 'DELETE', subject: 'Mitra', userId: deletedById, details: { mitraId: id } })

            return { success: true }
        } catch (error) {
            logger.error('[MitraService] Error deleting mitra:', error as Error)
            return { success: false, error: 'Gagal menghapus mitra' }
        }
    }

    /**
     * Get mitra stats
     */
    async getStats(): Promise<ServiceResult<Record<string, unknown>>> {
        try {
            const stats = await this.repository.getStats()
            return { success: true, data: stats }
        } catch (error) {
            logger.error('[MitraService] Error getting stats:', error as Error)
            return { success: false, error: 'Gagal mengambil statistik mitra' }
        }
    }
}

// Singleton
let instance: MitraService | null = null
export function getMitraService(): MitraService {
    if (!instance) instance = new MitraService()
    return instance
}
