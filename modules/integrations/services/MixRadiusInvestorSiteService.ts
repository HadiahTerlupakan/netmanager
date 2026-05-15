import { createRouteServiceError } from "@/lib/api/route-service-error";
import type { IMixRadiusInvestorSiteRepository } from "../domain/ports/IMixRadiusInvestorSiteRepository";
import { MixRadiusInvestorSiteRepository } from "../repositories/MixRadiusInvestorSiteRepository";

export class MixRadiusInvestorSiteService {
  constructor(
    private readonly siteRepository: IMixRadiusInvestorSiteRepository = new MixRadiusInvestorSiteRepository(),
  ) {}

  /** Get investor sites with optional tenant scoping. */
  async getSites(tenantId?: string) {
    return this.siteRepository.findMany(tenantId);
  }

  /** Get one investor site by scoped identifier. */
  async getSite(id: string, tenantId?: string) {
    const site = await this.siteRepository.findById(id, tenantId);

    if (!site) {
      throw createRouteServiceError("Site Investor", 404);
    }

    return site;
  }

  /** Create a new investor site. */
  async createSite(input: {
    name: string;
    owners: unknown;
    isActive?: boolean;
    tenantId?: string;
  }) {
    return this.siteRepository.create({
      name: input.name,
      owners: Array.isArray(input.owners) ? input.owners : [],
      isActive: input.isActive ?? true,
      tenantId: input.tenantId,
    });
  }

  /** Update an existing investor site. */
  async updateSite(
    id: string,
    input: {
      name: string;
      owners: unknown;
      isActive?: boolean;
      tenantId?: string;
    },
  ) {
    const result = await this.siteRepository.update(id, {
      name: input.name,
      owners: Array.isArray(input.owners) ? input.owners : [],
      isActive: input.isActive ?? true,
      tenantId: input.tenantId,
    });

    if (result.count === 0) {
      throw createRouteServiceError("Site Investor", 404);
    }

    return this.getSite(id, input.tenantId);
  }

  /** Delete an investor site by scoped identifier. */
  async deleteSite(id: string, tenantId?: string) {
    const result = await this.siteRepository.delete(id, tenantId);

    if (result.count === 0) {
      throw createRouteServiceError(
        "Gagal menghapus Site Investor. Mungkin data sedang digunakan.",
        400,
      );
    }
  }
}
