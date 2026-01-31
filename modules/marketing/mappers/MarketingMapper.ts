/**
 * MarketingMapper
 *
 * Transforms Prisma entities to DTOs for API responses.
 */

import type { Canvasing, PointClaim } from '@prisma/client'
import type {
    CanvasingListItemDTO,
    CanvasingDetailDTO,
    PointClaimDTO,
    PointClaimListItemDTO,
    LoyaltyPointBalanceDTO,
    PointHistoryDTO,
} from '../dto/MarketingDTO'

// Extended types
type CanvasingWithRelations = Canvasing & {
    sales?: {
        id: string
        name: string | null
    }
    approver?: {
        id: string
        name: string | null
    } | null
    pointClaims?: PointClaimWithRelations | null
}

type PointClaimWithRelations = PointClaim & {
    sales?: {
        id: string
        name: string | null
    }
    canvasing?: {
        nama: string
    }
}

export class MarketingMapper {
    // ==================== Canvasing Mappers ====================

    /**
     * Map to canvasing list item DTO
     */
    static toCanvasingListItem(entity: CanvasingWithRelations): CanvasingListItemDTO {
        return {
            id: entity.id,
            nama: entity.nama,
            noTelpon: entity.noTelpon,
            alamat: entity.alamat,
            paket: entity.paket,
            status: entity.status,
            salesName: entity.sales?.name ?? null,
            createdAt: entity.createdAt.toISOString(),
        }
    }

    /**
     * Map to canvasing list items
     */
    static toCanvasingListItems(entities: CanvasingWithRelations[]): CanvasingListItemDTO[] {
        return entities.map(entity => this.toCanvasingListItem(entity))
    }

    /**
     * Map to canvasing detail DTO
     */
    static toCanvasingDetail(entity: CanvasingWithRelations): CanvasingDetailDTO {
        return {
            id: entity.id,
            nama: entity.nama,
            noKtp: entity.noKtp,
            noTelpon: entity.noTelpon,
            email: entity.email,
            alamat: entity.alamat,
            kabel: entity.kabel,
            odp: entity.odp,
            paket: entity.paket,
            sn: entity.sn,
            latitude: entity.latitude,
            longitude: entity.longitude,
            foto: entity.foto,
            fotoKtp: entity.fotoKtp,
            status: entity.status,
            isLocked: entity.isLocked,
            createdAt: entity.createdAt.toISOString(),
            updatedAt: entity.updatedAt.toISOString(),
            sales: {
                id: entity.sales?.id ?? entity.salesId,
                name: entity.sales?.name ?? null,
            },
            approver: entity.approver ? {
                id: entity.approver.id,
                name: entity.approver.name,
            } : null,
            approvedAt: entity.approvedAt?.toISOString() ?? null,
            workOrderId: entity.workOrderId,
            pointClaim: entity.pointClaims ? this.toPointClaim(entity.pointClaims) : null,
        }
    }

    // ==================== Point Claim Mappers ====================

    /**
     * Map to point claim DTO
     */
    static toPointClaim(entity: PointClaimWithRelations): PointClaimDTO {
        return {
            id: entity.id,
            canvasingId: entity.canvasingId,
            salesId: entity.salesId,
            salesName: entity.sales?.name ?? null,
            buktiUrls: entity.buktiUrls,
            keterangan: entity.keterangan,
            status: entity.status,
            points: entity.pointValue,
            createdAt: entity.createdAt.toISOString(),
            processedAt: entity.reviewedAt?.toISOString() ?? null,
        }
    }

    /**
     * Map to point claim list item DTO
     */
    static toPointClaimListItem(entity: PointClaimWithRelations): PointClaimListItemDTO {
        return {
            id: entity.id,
            salesName: entity.sales?.name ?? null,
            customerName: entity.canvasing?.nama ?? '',
            status: entity.status,
            points: entity.pointValue,
            createdAt: entity.createdAt.toISOString(),
        }
    }

    /**
     * Map to point claim list items
     */
    static toPointClaimListItems(entities: PointClaimWithRelations[]): PointClaimListItemDTO[] {
        return entities.map(entity => this.toPointClaimListItem(entity))
    }

    // ==================== Loyalty Point Mappers ====================

    /**
     * Calculate loyalty point balance
     */
    static toPointBalance(dto: {
        userId: string
        userName: string | null
        totalEarned: number
        pendingPoints: number
        redeemedPoints: number
    }): LoyaltyPointBalanceDTO {
        return {
            userId: dto.userId,
            userName: dto.userName,
            totalPoints: dto.totalEarned,
            pendingPoints: dto.pendingPoints,
            redeemedPoints: dto.redeemedPoints,
            availablePoints: dto.totalEarned - dto.pendingPoints - dto.redeemedPoints,
        }
    }

    /**
     * Map to point history DTO
     */
    static toPointHistory(dto: {
        id: string
        type: 'EARN' | 'REDEEM'
        points: number
        description: string
        createdAt: Date
    }): PointHistoryDTO {
        return {
            id: dto.id,
            type: dto.type,
            points: dto.points,
            description: dto.description,
            createdAt: dto.createdAt.toISOString(),
        }
    }
}
