import { CouponRepository } from "../repositories/CouponRepository";
import { CouponService } from "./CouponService";

/**
 * Create coupon service with default repository implementation.
 */
export function createCouponService(): CouponService {
  return new CouponService(new CouponRepository());
}

/**
 * Shared coupon service instance for module consumers.
 */
export const couponService = createCouponService();
