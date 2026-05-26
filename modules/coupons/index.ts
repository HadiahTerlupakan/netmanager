// Public API for Coupons Module

// Services (public)
export { CouponService } from "./services/CouponService";
export {
  CouponAnalyticsService,
  getCouponAnalyticsService,
} from "./services/CouponAnalyticsService";
export type {
  CouponAnalyticsResult,
  CouponAnalyticsSummary,
  TopCoupon,
  ExpiringCoupon,
} from "./services/CouponAnalyticsService";
export {
  couponService,
  createCouponService,
} from "./services/CouponServiceFactory";
export {
  createCouponSchema,
  updateCouponSchema,
  verifyCouponSchema,
} from "./services/CouponValidationService";
export type { ICouponRepository, VerifyCouponResult } from "./contracts";

// DTOs (public types for API responses and requests)
export type {
  CouponListItemDTO,
  CouponDetailDTO,
  CouponUsageDTO,
  CouponValidationDTO,
  CreateCouponDTO,
  CreateCouponInput,
  UpdateCouponDTO,
  ApplyCouponDTO,
} from "./dto/CouponDTO";

// NOTE: CouponRepository is intentionally NOT exported (internal implementation detail)
// NOTE: CouponFactory and CouponMapper are intentionally NOT exported (internal)
