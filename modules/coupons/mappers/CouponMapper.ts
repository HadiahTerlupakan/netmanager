/**
 * CouponMapper
 *
 * Transforms Prisma entities to DTOs for API responses.
 */

import type { Coupon, CouponUsage } from '@prisma/client'
import type {
    CouponListItemDTO,
    CouponDetailDTO,
    CouponUsageDTO,
    CouponValidationDTO,
} from '../dto/CouponDTO'

// Extended types
type CouponWithRelations = Coupon & {
    couponUsage?: (CouponUsage & {
        pelanggan?: {
            nama: string
        } | null
    })[]
}

export class CouponMapper {
    /**
     * Map to list item DTO
     */
    static toListItem(entity: Coupon): CouponListItemDTO {
        return {
            id: entity.id,
            code: entity.code,
            description: entity.description,
            discountType: entity.discountType,
            discountValue: entity.discountValue,
            quota: entity.quota,
            usedCount: entity.usedCount,
            remainingQuota: Math.max(0, entity.quota - entity.usedCount),
            isActive: entity.isActive,
            startDate: entity.startDate.toISOString(),
            endDate: entity.endDate.toISOString(),
        }
    }

    /**
     * Map array to list items
     */
    static toListItems(entities: Coupon[]): CouponListItemDTO[] {
        return entities.map(entity => this.toListItem(entity))
    }

    /**
     * Map to detail DTO
     */
    static toDetail(entity: CouponWithRelations): CouponDetailDTO {
        return {
            id: entity.id,
            code: entity.code,
            description: entity.description,
            discountType: entity.discountType,
            discountValue: entity.discountValue,
            minTransaction: entity.minTransaction,
            maxDiscount: entity.maxDiscount,
            quota: entity.quota,
            usedCount: entity.usedCount,
            remainingQuota: Math.max(0, entity.quota - entity.usedCount),
            isActive: entity.isActive,
            startDate: entity.startDate.toISOString(),
            endDate: entity.endDate.toISOString(),
            createdAt: entity.createdAt.toISOString(),
            updatedAt: entity.updatedAt.toISOString(),
            usageHistory: (entity.couponUsage ?? []).map(u => this.toUsage(u)),
        }
    }

    /**
     * Map usage to DTO
     */
    static toUsage(entity: CouponUsage & { pelanggan?: { nama: string } | null }): CouponUsageDTO {
        return {
            id: entity.id,
            usedAt: entity.usedAt.toISOString(),
            pelangganName: entity.pelanggan?.nama ?? null,
        }
    }

    /**
     * Create validation result DTO
     */
    static toValidationResult(
        coupon: Coupon | null,
        transactionAmount: number,
        errorMessage: string | null = null
    ): CouponValidationDTO {
        if (!coupon || errorMessage) {
            return {
                isValid: false,
                coupon: null,
                discountAmount: 0,
                errorMessage: errorMessage ?? 'Kupon tidak valid',
            }
        }

        // Calculate discount
        let discountAmount = 0
        if (coupon.discountType === 'PERCENT') {
            discountAmount = (transactionAmount * coupon.discountValue) / 100
            if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
                discountAmount = coupon.maxDiscount
            }
        } else {
            discountAmount = coupon.discountValue
        }

        return {
            isValid: true,
            coupon: this.toListItem(coupon),
            discountAmount,
            errorMessage: null,
        }
    }
}
