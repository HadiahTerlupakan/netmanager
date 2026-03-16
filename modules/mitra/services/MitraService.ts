import { prismaMitra } from '@/lib/prisma-mitra'
import { hash } from 'bcryptjs'
import { logger, logActivitySafe } from '@/lib/logger'
import { MitraRepository, getMitraRepository } from '../repositories/MitraRepository'
import type { CreateMitraDTO, UpdateMitraDTO, MitraFilters } from '../dto/MitraDTO'
import { checkGlobalIdentifier } from '@/lib/validations/global-identifier'

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
            const globalCheck = await checkGlobalIdentifier(data.email, 'MITRA')
            if (globalCheck.exists) {
                return { success: false, error: `Email sudah digunakan sebagai ${globalCheck.role}` }
            }

            // Validate mitra type (mapped from DTO employeeType temporarily, ideally DTO also updated)
            const mitraType = data.employeeType === 'MITRA_SALES' ? 'MITRA_SALES' : 'MITRA_TEKNISI';

            const passwordHash = await hash(data.password, 12)
            const id = crypto.randomUUID()

            // Create user + wallet in transaction
            await prismaMitra.$transaction(async (tx) => {
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
                        mitraRateWoPsb: data.mitraRateWoPsb,
                        mitraRateWoMaintenance: data.mitraRateWoMaintenance,
                        mitraRateCanvasing: data.mitraRateCanvasing,
                        mitraRateFeePelanggan: data.mitraRateFeePelanggan,
                        enableFeePelanggan: data.enableFeePelanggan ?? false,
                        bankAccountNo: data.bankAccountNo,
                        bankAccountName: data.bankAccountName,
                        targetHarian: data.targetHarian,
                        minWithdrawal: data.minWithdrawal,
                        mixradiusOwnerNames: data.mixradiusOwnerNames || [],
                        garansiHari: data.garansiHari,
                        slaGaransiJam: data.slaGaransiJam,
                        penaltyPsb: data.penaltyPsb,
                        penaltyMaintenance: data.penaltyMaintenance,
                        nik: data.nik,
                        tempatLahir: data.tempatLahir,
                        tanggalLahir: data.tanggalLahir ? new Date(data.tanggalLahir) : undefined,
                        alamat: data.alamat,
                        latitudeRumah: data.latitudeRumah,
                        longitudeRumah: data.longitudeRumah,
                        fotoDiri: data.fotoDiri,
                        fotoKtp: data.fotoKtp,
                        fotoSim: data.fotoSim,
                        fotoKk: data.fotoKk,
                        requiresFaceVerification: data.requiresFaceVerification ?? false,
                        isActive: true,
                    },
                })

                // Create wallet automatically
                const wallet = await tx.mitraWallet.findFirst({
                    where: { mitraId: id },
                })
                if (!wallet) {
                    await tx.mitraWallet.create({ data: { mitraId: id } })
                }
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
            const existing = await prismaMitra.mitra.findFirst({ where: { id } })
            if (!existing) {
                return { success: false, error: 'Mitra tidak ditemukan' }
            }

            // Check email uniqueness if changing
            if (data.email && data.email !== existing.email) {
                const globalCheck = await checkGlobalIdentifier(data.email, 'MITRA')
                if (globalCheck.exists) {
                    return { success: false, error: `Email sudah digunakan sebagai ${globalCheck.role}` }
                }
            }

            const mitraType = data.employeeType === 'MITRA_SALES' ? 'MITRA_SALES' : (data.employeeType === 'MITRA_TEKNISI' ? 'MITRA_TEKNISI' : undefined);

            let passwordHash = undefined;
            if (data.password) {
                passwordHash = await hash(data.password, 12);
            }

            await prismaMitra.mitra.update({
                where: { id },
                data: {
                    ...(data.name && { name: data.name }),
                    ...(data.email && { email: data.email }),
                    ...(passwordHash && { passwordHash }),
                    ...(data.phone !== undefined && { phone: data.phone }),
                    ...(mitraType && { mitraType }),
                    ...(data.siteId !== undefined && { siteId: data.siteId }),
                    ...(data.mitraRateWoPsb !== undefined && { mitraRateWoPsb: data.mitraRateWoPsb }),
                    ...(data.mitraRateWoMaintenance !== undefined && { mitraRateWoMaintenance: data.mitraRateWoMaintenance }),
                    ...(data.mitraRateCanvasing !== undefined && { mitraRateCanvasing: data.mitraRateCanvasing }),
                    ...(data.mitraRateFeePelanggan !== undefined && { mitraRateFeePelanggan: data.mitraRateFeePelanggan }),
                    ...(data.enableFeePelanggan !== undefined && { enableFeePelanggan: data.enableFeePelanggan }),
                    ...(data.mixradiusOwnerNames !== undefined && { mixradiusOwnerNames: data.mixradiusOwnerNames }),
                    ...(data.bankName !== undefined && { bankName: data.bankName }),
                    ...(data.bankAccountName !== undefined && { bankAccountName: data.bankAccountName }),
                    ...(data.targetHarian !== undefined && { targetHarian: data.targetHarian }),
                    ...(data.minWithdrawal !== undefined && { minWithdrawal: data.minWithdrawal }),
                    ...(data.garansiHari !== undefined && { garansiHari: data.garansiHari }),
                    ...(data.slaGaransiJam !== undefined && { slaGaransiJam: data.slaGaransiJam }),
                    ...(data.penaltyPsb !== undefined && { penaltyPsb: data.penaltyPsb }),
                    ...(data.penaltyMaintenance !== undefined && { penaltyMaintenance: data.penaltyMaintenance }),
                    ...(data.nik !== undefined && { nik: data.nik }),
                    ...(data.tempatLahir !== undefined && { tempatLahir: data.tempatLahir }),
                    ...(data.tanggalLahir !== undefined && { tanggalLahir: data.tanggalLahir ? new Date(data.tanggalLahir) : null }),
                    ...(data.alamat !== undefined && { alamat: data.alamat }),
                    ...(data.latitudeRumah !== undefined && { latitudeRumah: data.latitudeRumah }),
                    ...(data.longitudeRumah !== undefined && { longitudeRumah: data.longitudeRumah }),
                    ...(data.fotoDiri !== undefined && { fotoDiri: data.fotoDiri }),
                    ...(data.fotoKtp !== undefined && { fotoKtp: data.fotoKtp }),
                    ...(data.fotoSim !== undefined && { fotoSim: data.fotoSim }),
                    ...(data.fotoKk !== undefined && { fotoKk: data.fotoKk }),
                    ...(data.requiresFaceVerification !== undefined && { requiresFaceVerification: data.requiresFaceVerification }),
                    ...(data.isActive !== undefined && { isActive: data.isActive }),
                },
            })

            // Ensure wallet exists
            const wallet = await prismaMitra.mitraWallet.findFirst({
                where: { mitraId: id },
            })
            if (!wallet) {
                await prismaMitra.mitraWallet.create({ data: { mitraId: id } })
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
            await prismaMitra.mitra.update({
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

    /**
     * Get face verification logs for a mitra
     */
    async getFaceVerificationLogs(mitraId: string, page: number = 1, limit: number = 20) {
        try {
            const mitra = await prismaMitra.mitra.findFirst({ where: { id: mitraId }, select: { id: true } })
            if (!mitra) {
                return { success: false, error: 'Mitra tidak ditemukan' }
            }
            const result = await this.repository.getFaceVerificationLogs(mitraId, page, limit)
            return { success: true, data: result }
        } catch (error) {
            logger.error('[MitraService] Error fetching face verification logs:', error as Error)
            return { success: false, error: 'Gagal mengambil history verifikasi wajah' }
        }
    }
}

// Singleton
let instance: MitraService | null = null
export function getMitraService(): MitraService {
    if (!instance) instance = new MitraService()
    return instance
}
