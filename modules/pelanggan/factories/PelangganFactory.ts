/**
 * PelangganFactory
 *
 * Factory pattern for creating Pelanggan with different configurations.
 * Handles ID generation, validation, and default values.
 */

import type { Status, TipePelanggan } from '@prisma/client'
import type { CreatePelangganInput } from '../services/PelangganService'
import { prisma } from '@/lib/prisma'

export class PelangganFactory {
    /**
     * Create input for new HOME customer
     */
    static createHome(dto: {
        idPelanggan: string
        nama: string
        username: string
        password: string
        hargaPaketId: string
        tanggalAktif: string
        jatuhTempo: string
        alamat?: string
        noTelp?: string
        email?: string
        siteId?: string
    }): CreatePelangganInput {
        return {
            ...dto,
            tipe: 'HOME' as TipePelanggan,
            status: 'AKTIF' as Status,
            autoIsolir: true,
        }
    }

    /**
     * Create input for new BUSINESS customer
     */
    static createBusiness(dto: {
        idPelanggan: string
        nama: string
        username: string
        password: string
        hargaPaketId: string
        tanggalAktif: string
        jatuhTempo: string
        alamat?: string
        noTelp?: string
        email?: string
        siteId?: string
        jenisDokumen?: string
        noDokumen?: string
    }): CreatePelangganInput {
        return {
            ...dto,
            tipe: 'BISNIS' as TipePelanggan,
            status: 'AKTIF' as Status,
            autoIsolir: false, // Business customers typically don't auto-isolate
            usePPN: true,
        }
    }

    /**
     * Create input for TRIAL customer
     */
    static createTrial(dto: {
        nama: string
        username: string
        password: string
        hargaPaketId: string
        alamat?: string
        noTelp?: string
        email?: string
        siteId?: string
        trialDays?: number
    }): CreatePelangganInput {
        const trialDays = dto.trialDays ?? 7
        const now = new Date()
        const tanggalAktif = now.toISOString().split('T')[0]
        const jatuhTempo = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000)
            .toISOString().split('T')[0]

        return {
            idPelanggan: this.generateTrialId(),
            nama: dto.nama,
            username: dto.username,
            password: dto.password,
            hargaPaketId: dto.hargaPaketId,
            tanggalAktif,
            jatuhTempo,
            tipe: 'HOME' as TipePelanggan,
            status: 'TRIAL' as Status,
            autoIsolir: true,
            alamat: dto.alamat,
            noTelp: dto.noTelp,
            email: dto.email,
            siteId: dto.siteId,
        }
    }

    /**
     * Create input for migrated customer (from external system)
     */
    static createMigration(dto: {
        externalId: string
        nama: string
        username: string
        password: string
        hargaPaketId: string
        tipe: TipePelanggan
        status: Status
        tanggalAktif: string
        jatuhTempo: string
        alamat?: string
        noTelp?: string
        email?: string
        siteId?: string
    }): CreatePelangganInput {
        // Use external ID padded to 8 digits
        const idPelanggan = dto.externalId.padStart(8, '0').slice(-8)

        return {
            idPelanggan,
            nama: dto.nama,
            username: dto.username,
            password: dto.password,
            hargaPaketId: dto.hargaPaketId,
            tipe: dto.tipe,
            status: dto.status,
            tanggalAktif: dto.tanggalAktif,
            jatuhTempo: dto.jatuhTempo,
            autoIsolir: dto.status === 'AKTIF',
            alamat: dto.alamat,
            noTelp: dto.noTelp,
            email: dto.email,
            siteId: dto.siteId,
        }
    }

    /**
     * Generate next available ID for a site
     */
    static async generateNextId(sitePrefix?: string): Promise<string> {
        // Find the highest ID with the prefix
        const prefix = sitePrefix || ''

        const lastPelanggan = await prisma.pelanggan.findFirst({
            where: {
                idPelanggan: {
                    startsWith: prefix,
                }
            },
            orderBy: {
                idPelanggan: 'desc'
            },
            select: {
                idPelanggan: true
            }
        })

        if (!lastPelanggan) {
            // First customer with this prefix
            return `${prefix}00000001`.slice(-8)
        }

        // Increment the numeric part
        const numericPart = lastPelanggan.idPelanggan.replace(prefix, '')
        const nextNumber = parseInt(numericPart, 10) + 1

        return `${prefix}${nextNumber.toString().padStart(8 - prefix.length, '0')}`
    }

    /**
     * Generate trial ID (starts with 9)
     */
    private static generateTrialId(): string {
        const timestamp = Date.now().toString().slice(-7)
        return `9${timestamp}`
    }

    /**
     * Calculate jatuh tempo based on tanggal aktif and durasi paket
     */
    static async calculateJatuhTempo(
        tanggalAktif: string,
        hargaPaketId: string
    ): Promise<string> {
        const paket = await prisma.hargaPaket.findUnique({
            where: { id: hargaPaketId },
            select: { durasi: true, durasiUnit: true }
        })

        if (!paket) {
            throw new Error('Paket tidak ditemukan')
        }

        const startDate = new Date(tanggalAktif)
        let endDate: Date

        switch (paket.durasiUnit) {
            case 'JAM':
                endDate = new Date(startDate.getTime() + paket.durasi * 60 * 60 * 1000)
                break
            case 'HARI':
                endDate = new Date(startDate.getTime() + paket.durasi * 24 * 60 * 60 * 1000)
                break
            case 'BULAN':
            default:
                endDate = new Date(startDate)
                endDate.setMonth(endDate.getMonth() + paket.durasi)
                break
            case 'TAHUN':
                endDate = new Date(startDate)
                endDate.setFullYear(endDate.getFullYear() + paket.durasi)
                break
        }

        return endDate.toISOString().split('T')[0]
    }
}
