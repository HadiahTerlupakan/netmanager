// Public API for Coupons Module

// Services (public)
export { CouponService } from './services/CouponService'

// Repository interfaces (public - needed by consumers who inject the repo)
export type {
    ICouponRepository,
    CreateCouponInput,
    VerifyCouponResult,
} from './repositories/ICouponRepository'

// DTOs (public types for API responses and requests)
export type {
    CouponListItemDTO,
    CouponDetailDTO,
    CouponUsageDTO,
    CouponValidationDTO,
    CreateCouponDTO,
    UpdateCouponDTO,
    ApplyCouponDTO,
} from './dto/CouponDTO'

// NOTE: CouponRepository is intentionally NOT exported (internal implementation detail)
// NOTE: CouponFactory and CouponMapper are intentionally NOT exported (internal)
