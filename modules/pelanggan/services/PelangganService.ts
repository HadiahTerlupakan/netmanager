import { PelangganRepository } from '../repositories/PelangganRepository'
import type { PelangganWithPackage, FilterOptions } from '../repositories/PelangganRepository'
import type { Pelanggan, Status, TipePelanggan, DiscountType, DurasiUnit } from '@prisma/client'
import { hash } from 'bcryptjs'
import { afterCustomerCreate } from '@/lib/hooks/radius-sync-hooks'
import { prisma } from '@/lib/prisma'
import { AutomaticBillingService } from '@/modules/finance/services/AutomaticBillingService'
import { checkGlobalIdentifier } from '@/lib/validations/global-identifier'

export interface CreatePelangganInput {
    idPelanggan: string
    nama: string
    username: string
    password: string // PPPoE password
    passwordLogin: string // Portal login password
    hargaPaketId: string
    tipe: TipePelanggan
    tanggalAktif: string // YYYY-MM-DD format
    jatuhTempo: string // YYYY-MM-DD format
    status: Status
    autoIsolir?: boolean
    alamat?: string | null
    provinsi?: string | null
    kabupatenKota?: string | null
    kelurahanDesa?: string | null
    kecamatan?: string | null
    noTelp?: string | null
    email?: string | null
    latitude?: number | null
    longitude?: number | null
    jenisDokumen?: string | null
    noDokumen?: string | null
    fileKTP?: string | null
    fileRumahSekitar?: string | null
    fileBAST?: string | null
    catatan?: string | null
    usePPN?: boolean
    useDiscount?: boolean
    useProrate?: boolean
    discountType?: DiscountType | null
    discountValue?: number | null
    discountDuration?: number | null
    discountDurationUnit?: DurasiUnit | null
    biayaInstalasi?: number | null
    biayaInstalasiIsRecurring?: boolean
    biayaInstalasiDiskon?: number | null
    biayaSewaPerangkat?: number | null
    biayaSewaPerangkatIsRecurring?: boolean
    biayaSewaPerangkatDiskon?: number | null
    biayaLainnya?: number | null
    biayaLainnyaIsRecurring?: boolean
    biayaLainnyaDiskon?: number | null
    keteranganBiayaLainnya?: string | null
    odpId?: string | null
    siteId?: string | null
    billingAction?: 'CREATE_PAID_INVOICE' | 'CREATE_UNPAID_INVOICE' | 'DO_NOTHING'
}

export class PelangganService {
    private pelangganRepository: PelangganRepository

    constructor() {
        this.pelangganRepository = new PelangganRepository()
    }

    async getAllPelanggan(filter?: FilterOptions): Promise<PelangganWithPackage[]> {
        return this.pelangganRepository.findAll(filter)
    }

    async getAllPelangganPaginated(filter?: FilterOptions, page: number = 1, limit: number = 10) {
        return this.pelangganRepository.findAllPaginated(filter, page, limit)
    }

    async getPelanggan(id: string): Promise<Pelanggan | null> {
        return this.pelangganRepository.findById(id)
    }

    async getPelangganByIdPelanggan(idPelanggan: string): Promise<Pelanggan | null> {
        return this.pelangganRepository.findByIdPelanggan(idPelanggan)
    }

    async createPelanggan(data: CreatePelangganInput): Promise<PelangganWithPackage> {
        // Validate ID format (8 digits)
        if (!/^\d{8}$/.test(data.idPelanggan.trim())) {
            throw new Error('ID Pelanggan harus 8 digit angka')
        }

        // Check if ID already exists globally
        const globalIdCheck = await checkGlobalIdentifier(data.idPelanggan.trim())
        if (globalIdCheck.exists) {
            throw new Error(`ID Pelanggan sudah digunakan sebagai ${globalIdCheck.role}`)
        }

        // Check if username already exists globally
        const globalUsernameCheck = await checkGlobalIdentifier(data.username.trim())
        if (globalUsernameCheck.exists) {
            throw new Error(`Username sudah digunakan sebagai ${globalUsernameCheck.role}`)
        }

        // Check if email already exists globally if provided
        if (data.email) {
            const globalEmailCheck = await checkGlobalIdentifier(data.email.trim())
            if (globalEmailCheck.exists) {
                throw new Error(`Email sudah digunakan sebagai ${globalEmailCheck.role}`)
            }
        }

        // Check if HargaPaket exists
        const hargaPaketExists = await this.pelangganRepository.checkHargaPaketExists(data.hargaPaketId)
        if (!hargaPaketExists) {
            throw new Error('Harga Paket tidak ditemukan')
        }

        // Hash passwordLogin
        const passwordHash = await hash(data.passwordLogin.trim(), 12)

        // Parse dates
        const parseLocalDate = (dateStr: string): Date => {
            const [year, month, day] = dateStr.split('-').map(Number)
            return new Date(year, month - 1, day)
        }

        // Create pelanggan
        const pelanggan = await this.pelangganRepository.create({
            idPelanggan: data.idPelanggan.trim(),
            nama: data.nama.trim(),
            username: data.username.trim(),
            password: data.password.trim(),
            passwordHash,
            hargaPaketId: data.hargaPaketId,
            tipe: data.tipe,
            tanggalAktif: parseLocalDate(data.tanggalAktif),
            jatuhTempo: parseLocalDate(data.jatuhTempo),
            status: data.status,
            autoIsolir: data.autoIsolir,
            alamat: data.alamat?.trim() || null,
            provinsi: data.provinsi?.trim() || null,
            kabupatenKota: data.kabupatenKota?.trim() || null,
            kelurahanDesa: data.kelurahanDesa?.trim() || null,
            kecamatan: data.kecamatan?.trim() || null,
            noTelp: data.noTelp?.trim() || null,
            email: data.email?.trim() || null,
            latitude: data.latitude || null,
            longitude: data.longitude || null,
            jenisDokumen: data.jenisDokumen || null,
            noDokumen: data.noDokumen?.trim() || null,
            fileKTP: data.fileKTP || null,
            fileRumahSekitar: data.fileRumahSekitar || null,
            fileBAST: data.fileBAST || null,
            catatan: data.catatan?.trim() || null,
            usePPN: data.usePPN ?? true,
            useDiscount: data.useDiscount ?? false,
            useProrate: data.useProrate ?? false,
            discountType: data.discountType,
            discountValue: data.discountValue,
            discountDuration: data.discountDuration,
            discountDurationUnit: data.discountDurationUnit,
            biayaInstalasi: data.biayaInstalasi,
            biayaInstalasiIsRecurring: data.biayaInstalasiIsRecurring ?? false,
            biayaInstalasiDiskon: data.biayaInstalasiDiskon,
            biayaSewaPerangkat: data.biayaSewaPerangkat,
            biayaSewaPerangkatIsRecurring: data.biayaSewaPerangkatIsRecurring ?? true,
            biayaSewaPerangkatDiskon: data.biayaSewaPerangkatDiskon,
            biayaLainnya: data.biayaLainnya,
            biayaLainnyaIsRecurring: data.biayaLainnyaIsRecurring ?? false,
            biayaLainnyaDiskon: data.biayaLainnyaDiskon,
            keteranganBiayaLainnya: data.keteranganBiayaLainnya?.trim() || null,
            odpId: data.odpId?.trim() || null,
            siteId: data.siteId,
        })

        // RADIUS Auto-Sync Hook
        try {
            const syncResult = await afterCustomerCreate(prisma, pelanggan.id)
            if (!syncResult.success) {
                console.warn('[RADIUS] Auto-sync failed for customer:', pelanggan.username, syncResult.error)
                // Update DB with failure
                await this.pelangganRepository.updateSyncStatus(pelanggan.id, 'FAILED', syncResult.error)
            } else {
                // Update DB with success
                await this.pelangganRepository.updateSyncStatus(pelanggan.id, 'SYNCED', null)
            }
        } catch (syncError: unknown) {
            console.error('[RADIUS] Auto-sync error:', syncError)
            // Update DB with failure
            const errorMessage = syncError instanceof Error ? syncError.message : 'Terjadi kesalahan'
            await this.pelangganRepository.updateSyncStatus(pelanggan.id, 'FAILED', errorMessage)
        }

        // Handle Invoice Generation based on billingAction
        try {
            if (data.billingAction === 'CREATE_PAID_INVOICE' || data.billingAction === 'CREATE_UNPAID_INVOICE') {
                const isPaid = data.billingAction === 'CREATE_PAID_INVOICE';
                await AutomaticBillingService.generateImmediateInvoice(pelanggan.id, isPaid);
            } else {
                // Postpaid: DO_NOTHING initially, but trigger realtime check 
                // in case the jatuhTempo is somehow within the normal billing window
                await AutomaticBillingService.checkAndGenerateRealtimeInvoice(pelanggan.id);
            }
        } catch (billingErr) {
            console.error('[Billing] Failed to trigger invoice generation for new customer:', billingErr);
        }

        return pelanggan
    }

    async deletePelanggan(id: string): Promise<Pelanggan> {
        const existing = await this.pelangganRepository.findById(id)
        if (!existing) {
            throw new Error('Pelanggan tidak ditemukan')
        }
        return this.pelangganRepository.delete(id)
    }

    // ============================================
    // Customer Portal Methods
    // ============================================

    /**
     * Get customer profile for customer portal
     */
    async getProfile(customerId: string) {
        const customer = await this.pelangganRepository.findByIdWithPackage(customerId)
        if (!customer) {
            throw new Error('Data pelanggan tidak ditemukan')
        }

        return {
            id: customer.id,
            idPelanggan: customer.idPelanggan,
            nama: customer.nama,
            username: customer.username,
            email: customer.email,
            noTelp: customer.noTelp,
            alamat: customer.alamat,
            status: customer.status,
            tipe: customer.tipe,
            tanggalAktif: customer.tanggalAktif,
            jatuhTempo: customer.jatuhTempo,
            lokasi: {
                provinsi: customer.provinsi,
                kabupatenKota: customer.kabupatenKota,
                kecamatan: customer.kecamatan,
                kelurahanDesa: customer.kelurahanDesa,
            },
            preferences: {
                is2FAEnabled: customer.is2FAEnabled,
                isBillNotifEnabled: customer.isBillNotifEnabled,
                isPromoEnabled: customer.isPromoEnabled,
            },
            paket: customer.hargaPaket ? {
                nama: customer.hargaPaket.name,
                harga: customer.hargaPaket.harga,
                durasi: customer.hargaPaket.durasi,
                kecepatan: customer.hargaPaket.description,
                bandwidth: customer.hargaPaket.bandwidth ? {
                    nama: customer.hargaPaket.bandwidth.name,
                    download: customer.hargaPaket.bandwidth.maxLimitDownload,
                    upload: customer.hargaPaket.bandwidth.maxLimitUpload,
                } : null,
            } : null,
        }
    }

    /**
     * Update customer profile (phone, preferences)
     */
    async updateProfile(customerId: string, data: {
        noTelp?: string
        is2FAEnabled?: boolean
        isBillNotifEnabled?: boolean
        isPromoEnabled?: boolean
    }) {
        const updateData: Record<string, unknown> = {}

        if (typeof data.is2FAEnabled === 'boolean') updateData.is2FAEnabled = data.is2FAEnabled
        if (typeof data.isBillNotifEnabled === 'boolean') updateData.isBillNotifEnabled = data.isBillNotifEnabled
        if (typeof data.isPromoEnabled === 'boolean') updateData.isPromoEnabled = data.isPromoEnabled
        if (data.noTelp !== undefined) updateData.noTelp = data.noTelp

        if (Object.keys(updateData).length === 0) {
            throw new Error('Tidak ada data yang diupdate')
        }

        return this.pelangganRepository.updateProfile(customerId, updateData)
    }

    /**
     * Change customer password
     */
    async changePassword(customerId: string, currentPassword: string, newPassword: string) {
        // Validate new password
        if (newPassword.length < 6) {
            throw new Error('Password baru minimal 6 karakter')
        }

        // Verify current password
        const currentHash = await this.pelangganRepository.getPasswordHash(customerId)
        if (!currentHash) {
            throw new Error('Akun tidak memiliki password')
        }

        const { compare } = await import('bcryptjs')
        const isValid = await compare(currentPassword, currentHash)
        if (!isValid) {
            throw new Error('Password saat ini salah')
        }

        // Hash and update new password
        const newHash = await hash(newPassword, 12)
        return this.pelangganRepository.updateProfile(customerId, { passwordHash: newHash })
    }

    /**
     * Get payment history with pagination
     */
    async getPaymentHistory(customerId: string, page: number = 1, limit: number = 10) {
        const { payments, total } = await this.pelangganRepository.getPaymentHistory(customerId, { page, limit })

        const formattedPayments = payments.map((pay) => ({
            id: pay.id,
            amount: Number(pay.amount),
            paymentDate: pay.paymentDate,
            paymentMethod: pay.paymentMethod,
            reference: pay.reference,
            notes: pay.notes,
            invoice: pay.invoice ? {
                invoiceNumber: pay.invoice.invoiceNumber,
                status: pay.invoice.status,
            } : null,
            verified: !!pay.verifiedAt,
        }))

        const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0)

        return {
            payments: formattedPayments,
            summary: {
                totalPaid,
                transactionCount: total,
            },
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        }
    }

    /**
     * Get invoices with pagination
     */
    async getInvoices(customerId: string, page: number = 1, limit: number = 10, status?: string[]) {
        const { invoices, total } = await this.pelangganRepository.getInvoices(
            customerId,
            { page, limit, status }
        )

        return {
            invoices,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        }
    }

    /**
     * Validate invoices for payment
     */
    async validateInvoicesForPayment(invoiceIds: string[], customerId: string) {
        const validInvoices = await this.pelangganRepository.getInvoicesByIds(
            invoiceIds,
            customerId,
            ['SENT', 'OVERDUE']
        )

        if (validInvoices.length !== invoiceIds.length) {
            throw new Error('Beberapa tagihan tidak valid atau sudah dibayar')
        }

        const totalAmount = validInvoices.reduce(
            (sum, inv) => sum + (Number(inv.totalAmount) - Number(inv.paidAmount)),
            0
        )

        return { invoices: validInvoices, totalAmount }
    }
}

// Singleton instance
let pelangganServiceInstance: PelangganService | null = null

export function getPelangganService(): PelangganService {
    if (!pelangganServiceInstance) {
        pelangganServiceInstance = new PelangganService()
    }
    return pelangganServiceInstance
}
