// Public API for Marketing Module

// Services (public)
export { CanvasingService } from './services/CanvasingService'
export { PointClaimService } from './services/PointClaimService'

// Repository interfaces (public - needed by consumers who inject repos)
export type {
    ICanvasingRepository,
    CreateCanvasingInput,
    UpdateCanvasingInput,
    CanvasingWithSalesInfo,
    CanvasingWithSalesSite,
} from './repositories/ICanvasingRepository'

export type {
    IPointClaimRepository,
    CreatePointClaimInput,
    UpdatePointClaimInput,
    PointClaimWithRelations,
    PointSummary,
} from './repositories/IPointClaimRepository'

// DTOs (public types for API responses and requests)
export type {
    CanvasingListItemDTO,
    CanvasingDetailDTO,
    PointClaimDTO,
    PointClaimListItemDTO,
    LoyaltyPointBalanceDTO,
    PointHistoryDTO,
    CreateCanvasingDTO,
    ClaimPointsDTO,
} from './dto/MarketingDTO'

// NOTE: CanvasingRepository and PointClaimRepository are NOT exported (internal implementation details)
// NOTE: MarketingFactory and MarketingMapper are NOT exported (internal)
