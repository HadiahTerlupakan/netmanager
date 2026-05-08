import type { IDepartmentRepository } from "../domain/ports/IDepartmentRepository";
import type { ISiteRepository } from "../domain/ports/ISiteRepository";
import {
  createDepartmentRepository,
  createSiteRepository,
} from "../factories/RepositoryFactory";

interface AdminOptionDTO {
  id: string;
  name: string;
}

interface AdminOptionsResponseDTO {
  sites: AdminOptionDTO[];
  departments: AdminOptionDTO[];
}

/** Service untuk mengambil dropdown options admin. */
export class AdminOptionsRouteService {
  private readonly siteRepository: ISiteRepository;
  private readonly departmentRepository: IDepartmentRepository;

  constructor(
    siteRepository: ISiteRepository = createSiteRepository(),
    departmentRepository: IDepartmentRepository = createDepartmentRepository(),
  ) {
    this.siteRepository = siteRepository;
    this.departmentRepository = departmentRepository;
  }

  /** Ambil option site dan departemen untuk kebutuhan form admin. */
  async getOptions(
    allowedSiteIds?: string[],
  ): Promise<AdminOptionsResponseDTO> {
    const [sites, departments] = await Promise.all([
      this.siteRepository.findAll({ activeOnly: true }),
      this.departmentRepository.findAll(),
    ]);

    // Filter sites by scope if restricted
    const filteredSites =
      allowedSiteIds && allowedSiteIds.length > 0
        ? sites.filter((site) => allowedSiteIds.includes(site.id))
        : sites;

    return {
      sites: this.toSiteOptions(filteredSites),
      departments: this.toDepartmentOptions(departments),
    };
  }

  private toSiteOptions(
    sites: Array<{ id: string; name: string }>,
  ): AdminOptionDTO[] {
    return sites.map((site) => ({ id: site.id, name: site.name }));
  }

  private toDepartmentOptions(
    departments: Array<{ id: string; name: string }>,
  ): AdminOptionDTO[] {
    return departments.map((department) => ({
      id: department.id,
      name: department.name,
    }));
  }
}
