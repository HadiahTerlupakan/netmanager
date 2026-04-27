import type { CouponEntity, CouponUsageEntity } from "../entities/CouponEntity";
import type { CreateCouponInput } from "../../dto/CouponDTO";

/**
 * Result for coupon verification.
 */
export interface VerifyCouponResult {
  valid: boolean;
  error?: string;
  discountAmount: number;
  finalAmount: number;
  couponId?: string;
}

/**
 * Repository port for coupon persistence.
 */
export interface ICouponRepository {
  /**
   * Get all coupons with total count.
   */
  findAll(params?: {
    skip?: number;
    take?: number;
  }): Promise<{ items: CouponEntity[]; total: number }>;

  /**
   * Find coupon by id.
   */
  findById(id: string): Promise<CouponEntity | null>;

  /**
   * Find coupon by code.
   */
  findByCode(code: string): Promise<CouponEntity | null>;

  /**
   * Create a coupon.
   */
  create(data: CreateCouponInput): Promise<CouponEntity>;

  /**
   * Increment coupon usage count.
   */
  incrementUsage(id: string, tx?: unknown): Promise<CouponEntity>;

  /**
   * Record coupon usage.
   */
  recordUsage(
    couponId: string,
    pelangganId: string,
    tx?: unknown,
  ): Promise<CouponUsageEntity>;

  /**
   * Delete coupon by id.
   */
  delete(id: string): Promise<void>;
}
