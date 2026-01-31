/**
 * PelangganMapper
 *
 * Transforms Prisma entities to DTOs for API responses.
 * Ensures consistent data shape and hides sensitive fields (password, passwordHash).
 */

import type { Pelanggan } from '@prisma/client'
import type { PelangganWithPackage } from '../repositories/PelangganRepository'
import type {
    PelangganListItemDTO,
    PelangganDetailDTO,
    PelangganPortalDTO,
    PelangganOptionDTO,
    PaymentHistoryItemDTO,
} from '../dto/PelangganDTO'

// Extended type with full relations
type PelangganWithFullRelations = PelangganWithPackage & {
    site?: { id: string; name: string } | null
}

export class PelangganMapper {
    /**
     * Map to list item DTO (for table views)
     * Hides sensitive data like password
     */
    static toListItem(entity: PelangganWithFullRelations): PelangganListItemDTO {
        return {
            id: entity.id,
            idPelanggan: entity.idPelanggan,
            nama: entity.nama,
            username: entity.username,
            noTelp: entity.noTelp,
            status: entity.status,
            tipe: entity.tipe,
            jatuhTempo: entity.jatuhTempo.toISOString(),
            // Flattened relations
            paketName: entity.hargaPaket?.name ?? null,
            paketHarga: entity.hargaPaket?.harga ?? null,
            siteName: entity.site?.name ?? null,
        }
    }

    /**
     * Map array to list items
     */
    static toListItems(entities: PelangganWithFullRelations[]): PelangganListItemDTO[] {
        return entities.map(entity => this.toListItem(entity))
    }

    /**
     * Map to detail DTO (for admin detail view)
     */
    static toDetail(entity: PelangganWithFullRelations): PelangganDetailDTO {
        return {
            id: entity.id,
            idPelanggan: entity.idPelanggan,
            nama: entity.nama,
            username: entity.username,
            email: entity.email,
            noTelp: entity.noTelp,
            status: entity.status,
            tipe: entity.tipe,
            tanggalAktif: entity.tanggalAktif.toISOString(),
            jatuhTempo: entity.jatuhTempo.toISOString(),
            autoIsolir: entity.autoIsolir,
            // Address
            alamat: entity.alamat,
            lokasi: {
                provinsi: entity.provinsi,
                kabupatenKota: entity.kabupatenKota,
                kecamatan: entity.kecamatan,
                kelurahanDesa: entity.kelurahanDesa,
            },
            koordinat: {
                latitude: entity.latitude,
                longitude: entity.longitude,
            },
            // Documents
            dokumen: {
                jenisDokumen: entity.jenisDokumen,
                noDokumen: entity.noDokumen,
                fileKTP: entity.fileKTP,
                fileRumahSekitar: entity.fileRumahSekitar,
                fileBAST: entity.fileBAST,
            },
            // Package
            paket: entity.hargaPaket ? {
                id: entity.hargaPaket.id,
                nama: entity.hargaPaket.name,
                harga: entity.hargaPaket.harga,
                durasi: entity.hargaPaket.durasi,
                bandwidth: entity.hargaPaket.bandwidth ? {
                    nama: entity.hargaPaket.bandwidth.name,
                    download: entity.hargaPaket.bandwidth.maxLimitDownload,
                    upload: entity.hargaPaket.bandwidth.maxLimitUpload,
                } : null,
            } : null,
            // Billing
            billing: {
                usePPN: entity.usePPN,
                useDiscount: entity.useDiscount,
                useProrate: entity.useProrate,
                discountType: entity.discountType,
                discountValue: entity.discountValue,
                discountDuration: entity.discountDuration,
                discountDurationUnit: entity.discountDurationUnit,
                biayaInstalasi: entity.biayaInstalasi,
                biayaSewaPerangkat: entity.biayaSewaPerangkat,
                biayaLainnya: entity.biayaLainnya,
            },
            // Sync
            syncStatus: entity.syncStatus,
            syncError: entity.syncError,
            // Metadata
            catatan: entity.catatan,
            createdAt: entity.createdAt.toISOString(),
            updatedAt: entity.updatedAt.toISOString(),
        }
    }

    /**
     * Map to portal DTO (for customer self-service)
     * Only shows data relevant to the customer
     */
    static toPortal(entity: PelangganWithPackage): PelangganPortalDTO {
        return {
            id: entity.id,
            idPelanggan: entity.idPelanggan,
            nama: entity.nama,
            username: entity.username,
            email: entity.email,
            noTelp: entity.noTelp,
            alamat: entity.alamat,
            status: entity.status,
            tipe: entity.tipe,
            tanggalAktif: entity.tanggalAktif.toISOString(),
            jatuhTempo: entity.jatuhTempo.toISOString(),
            lokasi: {
                provinsi: entity.provinsi,
                kabupatenKota: entity.kabupatenKota,
                kecamatan: entity.kecamatan,
                kelurahanDesa: entity.kelurahanDesa,
            },
            preferences: {
                is2FAEnabled: entity.is2FAEnabled,
                isBillNotifEnabled: entity.isBillNotifEnabled,
                isPromoEnabled: entity.isPromoEnabled,
            },
            paket: entity.hargaPaket ? {
                nama: entity.hargaPaket.name,
                harga: entity.hargaPaket.harga,
                durasi: entity.hargaPaket.durasi,
                kecepatan: entity.hargaPaket.description,
                bandwidth: entity.hargaPaket.bandwidth ? {
                    nama: entity.hargaPaket.bandwidth.name,
                    download: entity.hargaPaket.bandwidth.maxLimitDownload,
                    upload: entity.hargaPaket.bandwidth.maxLimitUpload,
                } : null,
            } : null,
        }
    }

    /**
     * Map to option DTO (for dropdowns/selects)
     */
    static toOption(entity: Pelanggan): PelangganOptionDTO {
        return {
            id: entity.id,
            idPelanggan: entity.idPelanggan,
            nama: entity.nama,
            username: entity.username,
        }
    }

    /**
     * Map array to options
     */
    static toOptions(entities: Pelanggan[]): PelangganOptionDTO[] {
        return entities.map(entity => this.toOption(entity))
    }

    /**
     * Map payment to DTO
     */
    static toPaymentHistory(payment: {
        id: string
        amount: number | { toNumber(): number }
        paymentDate: Date
        paymentMethod: string | null
        reference: string | null
        notes: string | null
        verifiedAt: Date | null
        invoice: {
            invoiceNumber: string
            status: string
        } | null
    }): PaymentHistoryItemDTO {
        return {
            id: payment.id,
            amount: typeof payment.amount === 'number'
                ? payment.amount
                : payment.amount.toNumber(),
            paymentDate: payment.paymentDate.toISOString(),
            paymentMethod: payment.paymentMethod,
            reference: payment.reference,
            notes: payment.notes,
            invoice: payment.invoice ? {
                invoiceNumber: payment.invoice.invoiceNumber,
                status: payment.invoice.status,
            } : null,
            verified: !!payment.verifiedAt,
        }
    }

    /**
     * Map payments array to DTOs
     */
    static toPaymentHistoryList(payments: Parameters<typeof PelangganMapper.toPaymentHistory>[0][]): PaymentHistoryItemDTO[] {
        return payments.map(p => this.toPaymentHistory(p))
    }
}
