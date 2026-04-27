import type { CouponDiscountType } from "./CouponDiscountType";

/**
 * Domain entity for coupon usage history.
 */
export interface CouponUsageEntity {
  id: string;
  usedAt: Date;
  pelangganName: string | null;
}

/**
 * Domain entity for coupon aggregate.
 */
export interface CouponEntity {
  id: string;
  code: string;
  description: string | null;
  discountType: CouponDiscountType;
  discountValue: number;
  minTransaction: number;
  maxDiscount: number | null;
  quota: number;
  usedCount: number;
  isActive: boolean;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
  usageHistory: CouponUsageEntity[];
}
