// Public API for Coupons Module

// Services (public)
export { CouponService } from "./services/CouponService";
export {
  couponService,
  createCouponService,
} from "./services/CouponServiceFactory";
export {
  createCouponSchema,
  verifyCouponSchema,
} from "./validators/couponSchemas";

// Ports (public - needed by consumers who inject the repository)
export type {
  ICouponRepository,
  VerifyCouponResult,
} from "./domain/ports/ICouponRepository";

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
