import { prisma } from "@/lib/prisma";
import { getMitraLookupService } from "@/modules/mitra";
import { SiteService } from "@/modules/roles";
import { WorkOrderQueryService } from "@/modules/work-order";
import { CanvasingRepository } from "../repositories/CanvasingRepository";
import { PointClaimRepository } from "../repositories/PointClaimRepository";
import { CanvasingService } from "./CanvasingService";
import { PointClaimService } from "./PointClaimService";

/** Create canvasing service with its runtime dependencies. */
export function createCanvasingService(): CanvasingService {
  const mitraLookupService = getMitraLookupService();
  const siteService = new SiteService();

  return new CanvasingService(
    new CanvasingRepository(prisma, {
      findMitraIdsBySite: (siteId) => mitraLookupService.findIdsBySite(siteId),
      findMitraSummary: (id) => mitraLookupService.findCanvasingSummary(id),
      findSiteSummary: async (id) => {
        const result = await siteService.getSiteById(id);
        if (!result.success || !result.data) return null;
        return { id: result.data.id, name: result.data.name };
      },
    }),
    new WorkOrderQueryService(),
  );
}

/** Create point claim service with its runtime dependencies. */
export function createPointClaimService(): PointClaimService {
  return new PointClaimService(new PointClaimRepository(prisma));
}
