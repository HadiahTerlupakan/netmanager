import { Prisma, Status } from "@prisma/client";
import type { FilterOptions } from "../repositories/PelangganRepository";

export interface SiteRestriction {
  isRestricted: boolean;
  siteIds: string[];
  primarySiteId: string | null;
}

/**
 * Service untuk build filter dan input pelanggan dengan site restriction logic.
 * Memisahkan business logic dari API route layer.
 */
export class PelangganInputBuilderService {
  /**
   * Build filter options untuk list pelanggan dengan site restriction.
   */
  buildListFilter(
    restriction: SiteRestriction,
    params: {
      status?: Status | null;
      search?: string | null;
      siteIdParam?: string | null;
    },
  ): FilterOptions & { siteIds?: string[] } {
    const filter: FilterOptions & { siteIds?: string[] } = {};

    if (params.status) filter.status = params.status;
    if (params.search) filter.search = params.search;

    if (restriction.isRestricted) {
      if (restriction.siteIds.length === 0) {
        throw new Error("User tidak memiliki akses site");
      }
      filter.siteId = {
        in: restriction.siteIds,
      } as Prisma.StringNullableFilter;
    } else if (params.siteIdParam) {
      filter.siteId = params.siteIdParam;
    }

    return filter;
  }

  /**
   * Override siteId pada input pelanggan jika user restricted.
   */
  applySiteRestriction<T extends { siteId?: string | null }>(
    input: T,
    restriction: SiteRestriction,
  ): T {
    if (restriction.isRestricted) {
      if (!restriction.primarySiteId) {
        throw new Error("User tidak memiliki akses site");
      }
      return { ...input, siteId: restriction.primarySiteId };
    }
    return input;
  }
}

export const pelangganInputBuilderService = new PelangganInputBuilderService();
