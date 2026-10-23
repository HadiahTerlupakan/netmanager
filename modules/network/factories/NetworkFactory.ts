/**
 * NetworkFactory
 *
 * Factory pattern for creating network entities with different configurations.
 */

import type { DurasiUnit } from '@prisma/client'

export interface CreateRouterInput {
    name: string
    ipAddress: string
    timezone: string
    apiPort: number
    apiUsername: string
    apiPassword: string
    authPort: number
    accountingPort: number
    secretRadius: string
    isolirUrl?: string
    description?: string
    siteId?: string
}

export interface CreateHargaPaketInput {
    name: string
    profilePPPId: string
    bandwidthId?: string
    harga: number
    durasi: number
    durasiUnit: DurasiUnit
    usePPN: boolean
    ppnPercentage?: number
    useDiscount: boolean
    discountType?: string
    discountValue?: number
    discountDuration?: number
    description?: string
    featured: boolean
}

export class NetworkFactory {
    // ==================== Router Factory Methods ====================

    /**
     * Create standard router configuration
     */
    static createStandardRouter(dto: {
        name: string
        ipAddress: string
        apiUsername: string
        apiPassword: string
        secretRadius: string
        siteId?: string
    }): CreateRouterInput {
        return {
            name: dto.name,
            ipAddress: dto.ipAddress,
            timezone: '+07:00 Asia/Jakarta',
            apiPort: 8728,
            apiUsername: dto.apiUsername,
            apiPassword: dto.apiPassword,
            authPort: 7265,
            accountingPort: 7266,
            secretRadius: dto.secretRadius,
            siteId: dto.siteId,
        }
    }

    /**
     * Create router with custom ports
     */
    static createCustomRouter(dto: {
        name: string
        ipAddress: string
        apiPort: number
        apiUsername: string
        apiPassword: string
        authPort: number
        accountingPort: number
        secretRadius: string
        siteId?: string
    }): CreateRouterInput {
        return {
            name: dto.name,
            ipAddress: dto.ipAddress,
            timezone: '+07:00 Asia/Jakarta',
            apiPort: dto.apiPort,
            apiUsername: dto.apiUsername,
            apiPassword: dto.apiPassword,
            authPort: dto.authPort,
            accountingPort: dto.accountingPort,
            secretRadius: dto.secretRadius,
            siteId: dto.siteId,
        }
    }

    // ==================== HargaPaket Factory Methods ====================

    /**
     * Create monthly package (standard)
     */
    static createMonthlyPackage(dto: {
        name: string
        profilePPPId: string
        bandwidthId?: string
        harga: number
        description?: string
    }): CreateHargaPaketInput {
        return {
            name: dto.name,
            profilePPPId: dto.profilePPPId,
            bandwidthId: dto.bandwidthId,
            harga: dto.harga,
            durasi: 30,
            durasiUnit: 'HARI',
            usePPN: false,
            useDiscount: false,
            featured: false,
            description: dto.description,
        }
    }

    /**
     * Create package with PPN
     */
    static createPackageWithPPN(dto: {
        name: string
        profilePPPId: string
        bandwidthId?: string
        harga: number
        ppnPercentage: number
        description?: string
    }): CreateHargaPaketInput {
        return {
            name: dto.name,
            profilePPPId: dto.profilePPPId,
            bandwidthId: dto.bandwidthId,
            harga: dto.harga,
            durasi: 30,
            durasiUnit: 'HARI',
            usePPN: true,
            ppnPercentage: dto.ppnPercentage,
            useDiscount: false,
            featured: false,
            description: dto.description,
        }
    }

    /**
     * Create promotional package with discount
     */
    static createPromoPackage(dto: {
        name: string
        profilePPPId: string
        bandwidthId?: string
        harga: number
        discountType: 'PERCENTAGE' | 'FIXED'
        discountValue: number
        discountDuration: number
        description?: string
    }): CreateHargaPaketInput {
        return {
            name: dto.name,
            profilePPPId: dto.profilePPPId,
            bandwidthId: dto.bandwidthId,
            harga: dto.harga,
            durasi: 30,
            durasiUnit: 'HARI',
            usePPN: false,
            useDiscount: true,
            discountType: dto.discountType,
            discountValue: dto.discountValue,
            discountDuration: dto.discountDuration,
            featured: true,
            description: dto.description,
        }
    }

    /**
     * Create hourly package (for voucher)
     */
    static createHourlyPackage(dto: {
        name: string
        profilePPPId: string
        harga: number
        durasi: number
    }): CreateHargaPaketInput {
        return {
            name: dto.name,
            profilePPPId: dto.profilePPPId,
            harga: dto.harga,
            durasi: dto.durasi,
            durasiUnit: 'JAM',
            usePPN: false,
            useDiscount: false,
            featured: false,
        }
    }
}
