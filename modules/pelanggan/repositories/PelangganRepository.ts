import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type { Pelanggan, Status, TipePelanggan, DiscountType, DurasiUnit } from '@prisma/client'

export interface CreatePelangganDTO {
    idPelanggan: string
    nama: string
    username: string
    password: string
    passwordLogin: string
    passwordHash: string
    hargaPaketId: string
    tipe: TipePelanggan
    tanggalAktif: Date
    jatuhTempo: Date
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
}

// Use Prisma's generated type for accurate typing
const pelangganWithPackage = Prisma.validator<Prisma.PelangganDefaultArgs>()({
    include: {
        hargaPaket: {
            include: {
                profilePPP: true,
                bandwidth: true,
            },
        },
    },
})

export type PelangganWithPackage = Prisma.PelangganGetPayload<typeof pelangganWithPackage>

export interface FilterOptions {
    status?: Status
}

export class PelangganRepository {
    async findAll(filter?: FilterOptions): Promise<PelangganWithPackage[]> {
        const where: any = {}
        if (filter?.status) {
            where.status = filter.status
        }

        return prisma.pelanggan.findMany({
            where,
            include: {
                hargaPaket: {
                    include: {
                        profilePPP: true,
                        bandwidth: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        })
    }

    async findById(id: string): Promise<Pelanggan | null> {
        return prisma.pelanggan.findUnique({
            where: { id }
        })
    }

    async findByIdPelanggan(idPelanggan: string): Promise<Pelanggan | null> {
        return prisma.pelanggan.findUnique({
            where: { idPelanggan }
        })
    }

    async findByUsername(username: string): Promise<Pelanggan | null> {
        return prisma.pelanggan.findFirst({
            where: { username }
        })
    }

    async create(data: CreatePelangganDTO): Promise<PelangganWithPackage> {
        return prisma.pelanggan.create({
            data: {
                idPelanggan: data.idPelanggan,
                nama: data.nama,
                username: data.username,
                password: data.password,
                passwordLogin: data.passwordLogin,
                passwordHash: data.passwordHash,
                hargaPaketId: data.hargaPaketId,
                tipe: data.tipe,
                tanggalAktif: data.tanggalAktif,
                jatuhTempo: data.jatuhTempo,
                status: data.status,
                autoIsolir: data.autoIsolir ?? true,
                alamat: data.alamat,
                provinsi: data.provinsi,
                kabupatenKota: data.kabupatenKota,
                kelurahanDesa: data.kelurahanDesa,
                kecamatan: data.kecamatan,
                noTelp: data.noTelp,
                email: data.email,
                latitude: data.latitude,
                longitude: data.longitude,
                jenisDokumen: data.jenisDokumen,
                noDokumen: data.noDokumen,
                fileKTP: data.fileKTP,
                fileRumahSekitar: data.fileRumahSekitar,
                fileBAST: data.fileBAST,
                catatan: data.catatan,
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
                keteranganBiayaLainnya: data.keteranganBiayaLainnya,
                odpId: data.odpId,
            },
            include: {
                hargaPaket: {
                    include: {
                        profilePPP: true,
                        bandwidth: true,
                    },
                },
            },
        })
    }

    async update(id: string, data: Partial<CreatePelangganDTO>): Promise<Pelanggan> {
        return prisma.pelanggan.update({
            where: { id },
            data,
        })
    }

    async delete(id: string): Promise<Pelanggan> {
        return prisma.pelanggan.delete({
            where: { id }
        })
    }

    async checkHargaPaketExists(id: string): Promise<boolean> {
        const hargaPaket = await prisma.hargaPaket.findUnique({
            where: { id }
        })
        return hargaPaket !== null
    }
}
