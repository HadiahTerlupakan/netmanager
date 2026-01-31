/**
 * MarketingFactory
 *
 * Factory pattern for creating Marketing entities (Canvasing, PointClaim).
 */

import type { CanvasingStatus, PointClaimStatus } from '@prisma/client'

export interface CreateCanvasingInput {
    nama: string
    noKtp: string
    noTelpon: string
    email?: string
    alamat: string
    kabel: number
    odp?: string
    paket: string
    sn?: string
    latitude?: number
    longitude?: number
    foto?: string
    fotoKtp?: string
    status: CanvasingStatus
    salesId: string
}

export interface CreatePointClaimInput {
    canvasingId: string
    salesId: string
    buktiUrls: string[]
    keterangan?: string
    pointValue: number
    status: PointClaimStatus
}

export class MarketingFactory {
    /**
     * Create new canvasing entry
     */
    static createCanvasing(dto: {
        nama: string
        noKtp: string
        noTelpon: string
        email?: string
        alamat: string
        kabel: number
        odp?: string
        paket: string
        latitude?: number
        longitude?: number
        foto?: string
        fotoKtp?: string
        salesId: string
    }): CreateCanvasingInput {
        return {
            nama: dto.nama,
            noKtp: dto.noKtp,
            noTelpon: dto.noTelpon,
            email: dto.email,
            alamat: dto.alamat,
            kabel: dto.kabel,
            odp: dto.odp,
            paket: dto.paket,
            latitude: dto.latitude,
            longitude: dto.longitude,
            foto: dto.foto,
            fotoKtp: dto.fotoKtp,
            status: 'PENDING',
            salesId: dto.salesId,
        }
    }

    /**
     * Create canvasing from referral
     */
    static createFromReferral(dto: {
        nama: string
        noTelpon: string
        alamat: string
        paket: string
        referredBy: string
        salesId: string
    }): CreateCanvasingInput {
        return {
            nama: dto.nama,
            noKtp: '',
            noTelpon: dto.noTelpon,
            alamat: dto.alamat,
            kabel: 0,
            paket: dto.paket,
            status: 'PENDING',
            salesId: dto.salesId,
        }
    }

    /**
     * Create canvasing for business customer
     */
    static createBusinessCanvasing(dto: {
        companyName: string
        contactPerson: string
        noTelpon: string
        email: string
        alamat: string
        paket: string
        salesId: string
    }): CreateCanvasingInput {
        return {
            nama: `${dto.companyName} (${dto.contactPerson})`,
            noKtp: '',
            noTelpon: dto.noTelpon,
            email: dto.email,
            alamat: dto.alamat,
            kabel: 0,
            paket: dto.paket,
            status: 'PENDING',
            salesId: dto.salesId,
        }
    }

    /**
     * Create point claim for completed canvasing
     */
    static createPointClaim(dto: {
        canvasingId: string
        salesId: string
        buktiUrls: string[]
        keterangan?: string
        pointValue?: number
    }): CreatePointClaimInput {
        return {
            canvasingId: dto.canvasingId,
            salesId: dto.salesId,
            buktiUrls: dto.buktiUrls,
            keterangan: dto.keterangan,
            pointValue: dto.pointValue ?? 2, // Default 2 points per conversion
            status: 'PENDING',
        }
    }

    /**
     * Create bonus point claim (special promotions)
     */
    static createBonusPointClaim(dto: {
        canvasingId: string
        salesId: string
        buktiUrls: string[]
        bonusReason: string
        bonusPoints: number
    }): CreatePointClaimInput {
        return {
            canvasingId: dto.canvasingId,
            salesId: dto.salesId,
            buktiUrls: dto.buktiUrls,
            keterangan: `[BONUS] ${dto.bonusReason}`,
            pointValue: dto.bonusPoints,
            status: 'PENDING',
        }
    }

    /**
     * Calculate points based on package value
     */
    static calculatePoints(packagePrice: number): number {
        // 1 point per 100k package value, minimum 1 point
        return Math.max(1, Math.floor(packagePrice / 100000))
    }
}
