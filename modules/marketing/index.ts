// Public API for Marketing Module

import { prisma } from "@/lib/prisma";
import { WorkOrderRepository } from "@/modules/work-order";
import { CanvasingRepository } from "./repositories/CanvasingRepository";
import { PointClaimRepository } from "./repositories/PointClaimRepository";
import { CanvasingService } from "./services/CanvasingService";
import { PointClaimService } from "./services/PointClaimService";

// Services (public)
export { CanvasingService } from "./services/CanvasingService";
export { PointClaimService } from "./services/PointClaimService";
export * from "./services/CanvasingAccessService";

export function createCanvasingService(): CanvasingService {
  return new CanvasingService(
    new CanvasingRepository(prisma),
    new WorkOrderRepository(),
  );
}

export function createPointClaimService(): PointClaimService {
  return new PointClaimService(new PointClaimRepository(prisma), prisma);
}

// Repositories (public - needed by admin/dashboard consumers)
export { PointClaimRepository } from "./repositories/PointClaimRepository";
export { CanvasingRepository } from "./repositories/CanvasingRepository";

// Repository interfaces (public - needed by consumers who inject repos)
export type {
  ICanvasingRepository,
  CreateCanvasingInput,
  UpdateCanvasingInput,
  CanvasingWithSalesInfo,
  CanvasingWithSalesSite,
} from "./repositories/ICanvasingRepository";

export type {
  IPointClaimRepository,
  CreatePointClaimInput,
  UpdatePointClaimInput,
  PointClaimWithRelations,
  PointSummary,
} from "./repositories/IPointClaimRepository";

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
} from "./dto/MarketingDTO";

// NOTE: CanvasingRepository and PointClaimRepository are NOT exported (internal implementation details)
// NOTE: MarketingFactory and MarketingMapper are NOT exported (internal)
