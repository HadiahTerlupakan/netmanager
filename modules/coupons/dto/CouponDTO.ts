/**
 * Coupon DTOs (Data Transfer Objects)
 */

import type { CouponDiscountType } from "../domain/entities/CouponDiscountType";

// ==================== Response DTOs ====================

/**
 * DTO for coupon list views
 */
export interface CouponListItemDTO {
  id: string;
  code: string;
  description: string | null;
  discountType: CouponDiscountType;
  discountValue: number;
  quota: number;
  usedCount: number;
  remainingQuota: number;
  isActive: boolean;
  startDate: string;
  endDate: string;
}

/**
 * DTO for coupon detail views
 */
export interface CouponDetailDTO {
  id: string;
  code: string;
  description: string | null;
  discountType: CouponDiscountType;
  discountValue: number;
  minTransaction: number;
  maxDiscount: number | null;
  quota: number;
  usedCount: number;
  remainingQuota: number;
  isActive: boolean;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
  usageHistory: CouponUsageDTO[];
}

/**
 * DTO for coupon usage
 */
export interface CouponUsageDTO {
  id: string;
  usedAt: string;
  pelangganName: string | null;
}

/**
 * DTO for coupon validation result
 */
export interface CouponValidationDTO {
  isValid: boolean;
  coupon: CouponListItemDTO | null;
  discountAmount: number;
  errorMessage: string | null;
}

// ==================== Request DTOs ====================

/**
 * DTO for creating coupon
 */
export interface CreateCouponDTO {
  code: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  minTransaction?: number;
  maxDiscount?: number;
  quota: number;
  startDate: string;
  endDate: string;
}

/**
 * Input model for creating coupon in application layer.
 */
export interface CreateCouponInput {
  code: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  startDate: Date;
  endDate: Date;
  minTransaction: number;
  maxDiscount?: number;
  quota: number;
  isActive: boolean;
}

/**
 * Input model for updating coupon in application layer.
 */
export interface UpdateCouponInput {
  description?: string;
  discountValue?: number;
  minTransaction?: number;
  maxDiscount?: number | null;
  quota?: number;
  isActive?: boolean;
  endDate?: Date;
}

/**
 * DTO for updating coupon
 */
export interface UpdateCouponDTO {
  description?: string;
  discountValue?: number;
  minTransaction?: number;
  maxDiscount?: number;
  quota?: number;
  isActive?: boolean;
  endDate?: string;
}

/**
 * DTO for applying coupon
 */
export interface ApplyCouponDTO {
  code: string;
  transactionAmount: number;
  pelangganId?: string;
}
