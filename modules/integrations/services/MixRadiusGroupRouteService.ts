import { SiteService } from "@/modules/roles";
import {
  MixRadiusOwnerGroupFacadeService,
  type MixRadiusOwnerGroup,
} from "./MixRadiusOwnerGroupFacadeService";

type SiteLookup = {
  id: string;
  name: string;
};

type MixRadiusGroupServicePort = {
  getOwnerGroups(tenantId?: string): Promise<MixRadiusOwnerGroup[]>;
};

type SiteServicePort = {
  getSites(): Promise<SiteLookup[]>;
};

/** Adapter to unwrap ServiceResult from SiteService into plain array. */
class SiteServiceAdapter implements SiteServicePort {
  private readonly service = new SiteService();

  async getSites(): Promise<SiteLookup[]> {
    const result = await this.service.getSites();
    if (!result.success || !result.data) return [];
    return result.data.map((s) => ({ id: s.id, name: s.name }));
  }
}

type MixRadiusGroupRouteServiceDeps = {
  mixRadiusService?: MixRadiusGroupServicePort;
  siteService?: SiteServicePort;
};

export type MobileMixRadiusGroupDTO = {
  id: string;
  name: string;
  owners: string[];
  isActive: boolean;
  siteId?: string;
};

export class MixRadiusGroupRouteService {
  private readonly mixRadiusService: MixRadiusGroupServicePort;
  private readonly siteService: SiteServicePort;

  constructor(deps: MixRadiusGroupRouteServiceDeps = {}) {
    this.mixRadiusService =
      deps.mixRadiusService ?? new MixRadiusOwnerGroupFacadeService();
    this.siteService = deps.siteService ?? new SiteServiceAdapter();
  }

  /** Get admin MixRadius owner groups enriched with site names. */
  async getAdminGroups(tenantId?: string) {
    const [groups, sites] = await Promise.all([
      this.mixRadiusService.getOwnerGroups(tenantId),
      this.siteService.getSites(),
    ]);
    const siteMap = new Map(sites.map((site) => [site.id, site.name]));

    return groups.map((group) => ({
      ...group,
      site:
        group.siteId && siteMap.has(group.siteId)
          ? { name: siteMap.get(group.siteId) }
          : undefined,
    }));
  }

  /** Get mobile MixRadius owner groups scoped by site. */
  async getMobileGroups(
    siteId?: string | null,
  ): Promise<MobileMixRadiusGroupDTO[]> {
    if (!siteId) {
      return [];
    }

    const groups = await this.mixRadiusService.getOwnerGroups();
    const scopedGroups = groups.filter((group) => group.siteId === siteId);

    return scopedGroups.map((group) => ({
      id: group.id,
      name: group.name,
      owners: group.owners,
      isActive: group.isActive,
      ...(group.siteId ? { siteId: group.siteId } : {}),
    }));
  }
}

let mixRadiusGroupRouteServiceInstance: MixRadiusGroupRouteService | null =
  null;

export function getMixRadiusGroupRouteService() {
  if (!mixRadiusGroupRouteServiceInstance) {
    mixRadiusGroupRouteServiceInstance = new MixRadiusGroupRouteService();
  }

  return mixRadiusGroupRouteServiceInstance;
}
