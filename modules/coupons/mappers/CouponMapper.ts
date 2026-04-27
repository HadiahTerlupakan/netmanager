/**
 * CouponMapper
 *
 * Transforms Prisma models to domain entities and domain entities to DTOs.
 */

import type { Coupon, CouponUsage } from "@prisma/client";

import type {
  CouponDetailDTO,
  CouponListItemDTO,
  CouponUsageDTO,
  CouponValidationDTO,
} from "../dto/CouponDTO";
import type {
  CouponEntity,
  CouponUsageEntity,
} from "../domain/entities/CouponEntity";

const ZERO_REMAINING_QUOTA = 0;
const ZERO_DISCOUNT = 0;
const DEFAULT_INVALID_COUPON_MESSAGE = "Kupon tidak valid";
const PERCENT_DISCOUNT_TYPE = "PERCENT";

type CouponUsageWithPelanggan = CouponUsage & {
  pelanggan?: {
    nama: string;
  } | null;
};

type CouponWithRelations = Coupon & {
  couponUsage?: CouponUsageWithPelanggan[];
};

export class CouponMapper {
  /**
   * Map Prisma coupon to domain entity.
   */
  static toDomain(model: CouponWithRelations): CouponEntity {
    return {
      id: model.id,
      code: model.code,
      description: model.description,
      discountType: model.discountType,
      discountValue: model.discountValue,
      minTransaction: model.minTransaction,
      maxDiscount: model.maxDiscount,
      quota: model.quota,
      usedCount: model.usedCount,
      isActive: model.isActive,
      startDate: model.startDate,
      endDate: model.endDate,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
      usageHistory: (model.couponUsage ?? []).map((usage) =>
        this.toUsageDomain(usage),
      ),
    };
  }

  /**
   * Map Prisma coupon usage to domain entity.
   */
  static toUsageDomain(model: CouponUsageWithPelanggan): CouponUsageEntity {
    return {
      id: model.id,
      usedAt: model.usedAt,
      pelangganName: model.pelanggan?.nama ?? null,
    };
  }

  /**
   * Map domain coupon to list DTO.
   */
  static toDTO(entity: CouponEntity): CouponListItemDTO {
    return {
      id: entity.id,
      code: entity.code,
      description: entity.description,
      discountType: entity.discountType,
      discountValue: entity.discountValue,
      quota: entity.quota,
      usedCount: entity.usedCount,
      remainingQuota: this.getRemainingQuota(entity),
      isActive: entity.isActive,
      startDate: entity.startDate.toISOString(),
      endDate: entity.endDate.toISOString(),
    };
  }

  /**
   * Map domain coupons to list DTOs.
   */
  static toDTOList(entities: CouponEntity[]): CouponListItemDTO[] {
    return entities.map((entity) => this.toDTO(entity));
  }

  /**
   * Map domain coupon to detail DTO.
   */
  static toDetailDTO(entity: CouponEntity): CouponDetailDTO {
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
      remainingQuota: this.getRemainingQuota(entity),
      isActive: entity.isActive,
      startDate: entity.startDate.toISOString(),
      endDate: entity.endDate.toISOString(),
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      usageHistory: entity.usageHistory.map((usage) => this.toUsageDTO(usage)),
    };
  }

  /**
   * Map domain coupon usage to DTO.
   */
  static toUsageDTO(entity: CouponUsageEntity): CouponUsageDTO {
    return {
      id: entity.id,
      usedAt: entity.usedAt.toISOString(),
      pelangganName: entity.pelangganName,
    };
  }

  /**
   * Build coupon validation DTO from domain entity.
   */
  static toValidationDTO(
    coupon: CouponEntity | null,
    transactionAmount: number,
    errorMessage: string | null = null,
  ): CouponValidationDTO {
    if (!coupon || errorMessage) {
      return this.createInvalidValidationDTO(errorMessage);
    }

    return {
      isValid: true,
      coupon: this.toDTO(coupon),
      discountAmount: this.calculateDiscountAmount(coupon, transactionAmount),
      errorMessage: null,
    };
  }

  /**
   * Calculate remaining quota.
   */
  private static getRemainingQuota(entity: CouponEntity): number {
    return Math.max(ZERO_REMAINING_QUOTA, entity.quota - entity.usedCount);
  }

  /**
   * Create invalid validation DTO.
   */
  private static createInvalidValidationDTO(
    errorMessage: string | null,
  ): CouponValidationDTO {
    return {
      isValid: false,
      coupon: null,
      discountAmount: ZERO_DISCOUNT,
      errorMessage: errorMessage ?? DEFAULT_INVALID_COUPON_MESSAGE,
    };
  }

  /**
   * Calculate discount amount from coupon entity.
   */
  private static calculateDiscountAmount(
    coupon: CouponEntity,
    transactionAmount: number,
  ): number {
    if (coupon.discountType !== PERCENT_DISCOUNT_TYPE) {
      return coupon.discountValue;
    }

    const percentageDiscount = (transactionAmount * coupon.discountValue) / 100;
    if (!coupon.maxDiscount) {
      return percentageDiscount;
    }

    return Math.min(percentageDiscount, coupon.maxDiscount);
  }
}
