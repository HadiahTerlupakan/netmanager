/**
 * NetworkMapper
 *
 * Transforms Prisma entities to DTOs for API responses.
 */

import type { MikroTikRouter, Odp, OdpOutput, HargaPaket } from '@prisma/client'
import type {
    RouterListItemDTO,
    RouterDetailDTO,
    RouterOptionDTO,
    OdpListItemDTO,
    OdpDetailDTO,
    OdpOutputDTO,
    OdpOptionDTO,
    HargaPaketListItemDTO,
    HargaPaketDetailDTO,
    HargaPaketOptionDTO,
} from '../dto/NetworkDTO'

// Extended types
type RouterWithRelations = MikroTikRouter & {
    site?: {
        id: string
        name: string
    } | null
}

type OdpWithRelations = Odp & {
    site?: {
        id: string
        name: string
    } | null
    odpOutput?: OdpOutput[]
    _count?: {
        pelanggan?: number
        odpOutput?: number
    }
}

type HargaPaketWithRelations = HargaPaket & {
    bandwidth?: {
        id: string
        name: string
    } | null
    profilePPP?: {
        id: string
        name: string
    }
    _count?: {
        pelanggan?: number
    }
}

export class NetworkMapper {
    // ==================== Router Mappers ====================

    /**
     * Map router to list item DTO
     */
    static routerToListItem(entity: RouterWithRelations): RouterListItemDTO {
        return {
            id: entity.id,
            name: entity.name,
            ipAddress: entity.ipAddress,
            pingStatus: entity.pingStatus,
            userOnline: entity.userOnline,
            lastStatusCheck: entity.lastStatusCheck?.toISOString() ?? null,
            siteName: entity.site?.name ?? null,
        }
    }

    /**
     * Map routers to list items
     */
    static routersToListItems(entities: RouterWithRelations[]): RouterListItemDTO[] {
        return entities.map(entity => this.routerToListItem(entity))
    }

    /**
     * Map router to detail DTO
     */
    static routerToDetail(entity: RouterWithRelations): RouterDetailDTO {
        return {
            id: entity.id,
            name: entity.name,
            ipAddress: entity.ipAddress,
            timezone: entity.timezone,
            apiPort: entity.apiPort,
            apiUsername: entity.apiUsername,
            authPort: entity.authPort,
            accountingPort: entity.accountingPort,
            isolirUrl: entity.isolirUrl,
            description: entity.description,
            pingStatus: entity.pingStatus,
            userOnline: entity.userOnline,
            lastStatusCheck: entity.lastStatusCheck?.toISOString() ?? null,
            createdAt: entity.createdAt.toISOString(),
            updatedAt: entity.updatedAt.toISOString(),
            site: entity.site ? {
                id: entity.site.id,
                name: entity.site.name,
            } : null,
        }
    }

    /**
     * Map router to option DTO
     */
    static routerToOption(entity: MikroTikRouter): RouterOptionDTO {
        return {
            id: entity.id,
            name: entity.name,
            ipAddress: entity.ipAddress,
        }
    }

    // ==================== ODP Mappers ====================

    /**
     * Map ODP to list item DTO
     */
    static odpToListItem(entity: OdpWithRelations): OdpListItemDTO {
        return {
            id: entity.id,
            name: entity.name,
            location: entity.location,
            status: entity.status,
            latitude: entity.latitude,
            longitude: entity.longitude,
            siteName: entity.site?.name ?? null,
            outputCount: entity._count?.odpOutput ?? entity.odpOutput?.length ?? 0,
            pelangganCount: entity._count?.pelanggan ?? 0,
        }
    }

    /**
     * Map ODPs to list items
     */
    static odpsToListItems(entities: OdpWithRelations[]): OdpListItemDTO[] {
        return entities.map(entity => this.odpToListItem(entity))
    }

    /**
     * Map ODP to detail DTO
     */
    static odpToDetail(entity: OdpWithRelations): OdpDetailDTO {
        return {
            id: entity.id,
            name: entity.name,
            location: entity.location,
            notes: entity.notes,
            images: entity.images,
            latitude: entity.latitude,
            longitude: entity.longitude,
            status: entity.status,
            keteranganJumlahKabelFeeder: entity.keteranganJumlahKabelFeeder,
            createdAt: entity.createdAt.toISOString(),
            updatedAt: entity.updatedAt.toISOString(),
            site: entity.site ? {
                id: entity.site.id,
                name: entity.site.name,
            } : null,
            outputs: (entity.odpOutput ?? []).map(o => this.odpOutputToDTO(o)),
        }
    }

    /**
     * Map ODP output to DTO
     */
    static odpOutputToDTO(entity: OdpOutput): OdpOutputDTO {
        return {
            id: entity.id,
            idx: entity.idx,
            slotName: entity.slotName,
            redaman: entity.redaman,
            tubeColor: entity.tubeColor,
            coreColor: entity.coreColor,
        }
    }

    /**
     * Map ODP to option DTO
     */
    static odpToOption(entity: Odp): OdpOptionDTO {
        return {
            id: entity.id,
            name: entity.name,
            location: entity.location,
        }
    }

    // ==================== HargaPaket Mappers ====================

    /**
     * Map package to list item DTO
     */
    static paketToListItem(entity: HargaPaketWithRelations): HargaPaketListItemDTO {
        return {
            id: entity.id,
            name: entity.name,
            harga: entity.harga,
            durasi: entity.durasi,
            durasiUnit: entity.durasiUnit,
            status: entity.status,
            featured: entity.featured,
            bandwidthName: entity.bandwidth?.name ?? null,
        }
    }

    /**
     * Map packages to list items
     */
    static paketsToListItems(entities: HargaPaketWithRelations[]): HargaPaketListItemDTO[] {
        return entities.map(entity => this.paketToListItem(entity))
    }

    /**
     * Map package to detail DTO
     */
    static paketToDetail(entity: HargaPaketWithRelations): HargaPaketDetailDTO {
        return {
            id: entity.id,
            name: entity.name,
            harga: entity.harga,
            durasi: entity.durasi,
            durasiUnit: entity.durasiUnit,
            usePPN: entity.usePPN,
            ppnPercentage: entity.ppnPercentage,
            useDiscount: entity.useDiscount,
            discountType: entity.discountType,
            discountValue: entity.discountValue,
            discountDuration: entity.discountDuration,
            description: entity.description,
            featured: entity.featured,
            status: entity.status,
            createdAt: entity.createdAt.toISOString(),
            updatedAt: entity.updatedAt.toISOString(),
            bandwidth: entity.bandwidth ? {
                id: entity.bandwidth.id,
                name: entity.bandwidth.name,
            } : null,
            profilePPP: entity.profilePPP ? {
                id: entity.profilePPP.id,
                name: entity.profilePPP.name,
            } : { id: entity.profilePPPId, name: '' },
            pelangganCount: entity._count?.pelanggan ?? 0,
        }
    }

    /**
     * Map package to option DTO
     */
    static paketToOption(entity: HargaPaket): HargaPaketOptionDTO {
        return {
            id: entity.id,
            name: entity.name,
            harga: entity.harga,
        }
    }
}
