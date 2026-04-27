/**
 * CouponFactory
 *
 * Factory pattern for creating coupons with different discount types.
 */

import type { CreateCouponInput } from "../dto/CouponDTO";
import type { CouponDiscountType } from "../domain/entities/CouponDiscountType";

export class CouponFactory {
  /**
   * Create percentage discount coupon
   */
  static createPercentageCoupon(dto: {
    code: string;
    description?: string;
    discountPercent: number;
    maxDiscount?: number;
    minTransaction?: number;
    quota: number;
    validDays: number;
  }): CreateCouponInput {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + dto.validDays);

    return {
      code: dto.code.toUpperCase(),
      description: dto.description,
      discountType: "PERCENT",
      discountValue: dto.discountPercent,
      minTransaction: dto.minTransaction ?? 0,
      maxDiscount: dto.maxDiscount,
      quota: dto.quota,
      startDate: now,
      endDate,
      isActive: true,
    };
  }

  /**
   * Create fixed amount discount coupon
   */
  static createFixedCoupon(dto: {
    code: string;
    description?: string;
    discountAmount: number;
    minTransaction?: number;
    quota: number;
    validDays: number;
  }): CreateCouponInput {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + dto.validDays);

    return {
      code: dto.code.toUpperCase(),
      description: dto.description,
      discountType: "FIXED",
      discountValue: dto.discountAmount,
      minTransaction: dto.minTransaction ?? 0,
      quota: dto.quota,
      startDate: now,
      endDate,
      isActive: true,
    };
  }

  /**
   * Create new customer welcome coupon
   */
  static createWelcomeCoupon(dto: {
    discountPercent: number;
    maxDiscount: number;
    validDays?: number;
  }): CreateCouponInput {
    const code = `WELCOME${Date.now().toString(36).toUpperCase()}`;
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + (dto.validDays ?? 30));

    return {
      code,
      description: "Kupon selamat datang untuk pelanggan baru",
      discountType: "PERCENT",
      discountValue: dto.discountPercent,
      minTransaction: 0,
      maxDiscount: dto.maxDiscount,
      quota: 1, // Single use
      startDate: now,
      endDate,
      isActive: true,
    };
  }

  /**
   * Create referral coupon
   */
  static createReferralCoupon(dto: {
    referrerName: string;
    discountAmount: number;
    validDays?: number;
  }): CreateCouponInput {
    const code = `REF${Date.now().toString(36).toUpperCase()}`;
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + (dto.validDays ?? 60));

    return {
      code,
      description: `Kupon referral dari ${dto.referrerName}`,
      discountType: "FIXED",
      discountValue: dto.discountAmount,
      minTransaction: 0,
      quota: 1,
      startDate: now,
      endDate,
      isActive: true,
    };
  }

  /**
   * Create promotional/campaign coupon
   */
  static createPromoCoupon(dto: {
    code: string;
    campaignName: string;
    discountType: CouponDiscountType;
    discountValue: number;
    maxDiscount?: number;
    minTransaction?: number;
    quota: number;
    startDate: Date;
    endDate: Date;
  }): CreateCouponInput {
    return {
      code: dto.code.toUpperCase(),
      description: `Promo: ${dto.campaignName}`,
      discountType: dto.discountType,
      discountValue: dto.discountValue,
      minTransaction: dto.minTransaction ?? 0,
      maxDiscount: dto.maxDiscount,
      quota: dto.quota,
      startDate: dto.startDate,
      endDate: dto.endDate,
      isActive: true,
    };
  }

  /**
   * Generate unique coupon code
   */
  static generateCode(prefix: string = "PROMO"): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}${timestamp}${random}`;
  }
}
