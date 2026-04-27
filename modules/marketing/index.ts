// Public API for Marketing Module

import { prisma } from "@/lib/prisma";
import { WorkOrderRepository } from "@/modules/work-order";
import { getMitraLookupService } from "@/modules/mitra";
import { SiteService } from "@/modules/roles";
import { CanvasingRepository } from "./repositories/CanvasingRepository";
import { PointClaimRepository } from "./repositories/PointClaimRepository";
import { CanvasingService } from "./services/CanvasingService";
import { PointClaimService } from "./services/PointClaimService";

// Services (public)
export { CanvasingService } from "./services/CanvasingService";
export { PointClaimService } from "./services/PointClaimService";
export { AdminSalesRouteService } from "./services/AdminSalesRouteService";
export { TestCanvasingRouteService } from "./services/TestCanvasingRouteService";
export * from "./services/CanvasingAccessService";

export function createCanvasingService(): CanvasingService {
  const mitraLookupService = getMitraLookupService();
  const siteService = new SiteService();

  return new CanvasingService(
    new CanvasingRepository(prisma, {
      findMitraIdsBySite: (siteId) => mitraLookupService.findIdsBySite(siteId),
      findMitraSummary: (id) => mitraLookupService.findCanvasingSummary(id),
      findSiteSummary: (id) => siteService.getSiteById(id),
    }),
    new WorkOrderRepository(),
  );
}

export function createPointClaimService(): PointClaimService {
  return new PointClaimService(new PointClaimRepository(prisma));
}

// Validators (public)
export {
  CANVASING_PACKAGE_OPTIONS,
  DEFAULT_CANVASING_FORM_VALUES,
  GENERIC_STATUS_UPDATE_FORBIDDEN_MESSAGE,
  getCanvasingValidationMessage,
  hasGenericStatusUpdate,
  parseCanvasingStatusParam,
  parseCreateCanvasingInput,
  parseUpdateCanvasingInput,
  validateCanvasingForm,
} from "./validators/canvasingValidation";
export type {
  CanvasingFormErrors,
  CanvasingFormValues,
} from "./validators/canvasingValidation";

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
