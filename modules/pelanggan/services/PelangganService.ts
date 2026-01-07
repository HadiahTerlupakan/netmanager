import { PelangganRepository } from '../repositories/PelangganRepository'
import type { CreatePelangganDTO, PelangganWithPackage, FilterOptions } from '../repositories/PelangganRepository'
import type { Pelanggan, Status, TipePelanggan, DiscountType, DurasiUnit } from '@prisma/client'
import { hash } from 'bcryptjs'
import { afterCustomerCreate } from '@/lib/hooks/radius-sync-hooks'
import { prisma } from '@/lib/prisma'

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
}

export class PelangganService {
    private pelangganRepository: PelangganRepository

    constructor() {
        this.pelangganRepository = new PelangganRepository()
    }

    async getAllPelanggan(filter?: FilterOptions): Promise<PelangganWithPackage[]> {
        return this.pelangganRepository.findAll(filter)
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

        // Check if ID already exists
        const existingById = await this.pelangganRepository.findByIdPelanggan(data.idPelanggan.trim())
        if (existingById) {
            throw new Error('ID Pelanggan sudah digunakan')
        }

        // Check if username already exists
        const existingByUsername = await this.pelangganRepository.findByUsername(data.username.trim())
        if (existingByUsername) {
            throw new Error('Username sudah digunakan')
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
            passwordLogin: data.passwordLogin.trim(),
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
            }
        } catch (syncError) {
            console.error('[RADIUS] Auto-sync error:', syncError)
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
}

// Singleton instance
let pelangganServiceInstance: PelangganService | null = null

export function getPelangganService(): PelangganService {
    if (!pelangganServiceInstance) {
        pelangganServiceInstance = new PelangganService()
    }
    return pelangganServiceInstance
}
