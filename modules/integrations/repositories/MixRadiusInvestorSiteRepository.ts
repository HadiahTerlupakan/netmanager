import { prismaBilling } from "@/modules/database";

export class MixRadiusInvestorSiteRepository {
  /** Get many investor sites by optional tenant scope. */
  async findMany(tenantId?: string) {
    return prismaBilling.mixRadiusInvestorSite.findMany({
      where: tenantId ? { tenantId } : undefined,
      orderBy: { createdAt: "desc" },
    });
  }

  /** Find one investor site by id and optional tenant scope. */
  async findById(id: string, tenantId?: string) {
    return prismaBilling.mixRadiusInvestorSite.findFirst({
      where: {
        id,
        ...(tenantId ? { tenantId } : {}),
      },
    });
  }

  /** Create a new investor site. */
  async create(input: {
    name: string;
    owners: string[];
    isActive: boolean;
    tenantId?: string;
  }) {
    return prismaBilling.mixRadiusInvestorSite.create({
      data: {
        name: input.name,
        owners: input.owners,
        isActive: input.isActive,
        tenantId: input.tenantId,
      },
    });
  }

  /** Update an investor site by scoped identifier. */
  async update(
    id: string,
    input: {
      name: string;
      owners: string[];
      isActive: boolean;
      tenantId?: string;
    },
  ) {
    return prismaBilling.mixRadiusInvestorSite.updateMany({
      where: {
        id,
        ...(input.tenantId ? { tenantId: input.tenantId } : {}),
      },
      data: {
        name: input.name,
        owners: input.owners,
        isActive: input.isActive,
      },
    });
  }

  /** Delete an investor site by scoped identifier. */
  async delete(id: string, tenantId?: string) {
    return prismaBilling.mixRadiusInvestorSite.deleteMany({
      where: {
        id,
        ...(tenantId ? { tenantId } : {}),
      },
    });
  }
}
