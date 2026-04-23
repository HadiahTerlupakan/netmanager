import { prismaBilling } from "@/lib/prisma-billing";

export type MixRadiusOwnerGroupPayload = {
  name: string;
  owners: string[];
  siteId?: string;
  isActive?: boolean;
  tenantId?: string;
};

export type MixRadiusOwnerGroupUpdatePayload = {
  name?: string;
  owners?: string[];
  siteId?: string;
  isActive?: boolean;
  tenantId?: string;
};

export class MixRadiusOwnerGroupService {
  async getOwnerGroups(tenantId?: string) {
    return prismaBilling.mixRadiusOwnerGroup.findMany({
      where: tenantId ? { tenantId } : undefined,
      orderBy: { name: "asc" },
    });
  }

  async getOwnerGroup(id: string, tenantId?: string) {
    return prismaBilling.mixRadiusOwnerGroup.findUnique({
      where: tenantId ? { id, tenantId } : { id },
    });
  }

  async createOwnerGroup(data: MixRadiusOwnerGroupPayload) {
    return prismaBilling.mixRadiusOwnerGroup.create({
      data,
    });
  }

  async updateOwnerGroup(id: string, data: MixRadiusOwnerGroupUpdatePayload) {
    const { tenantId, ...updateData } = data;
    return prismaBilling.mixRadiusOwnerGroup.update({
      where: tenantId ? { id, tenantId } : { id },
      data: updateData,
    });
  }

  async deleteOwnerGroup(id: string, tenantId?: string) {
    return prismaBilling.mixRadiusOwnerGroup.delete({
      where: tenantId ? { id, tenantId } : { id },
    });
  }
}

let mixRadiusOwnerGroupServiceInstance: MixRadiusOwnerGroupService | null =
  null;

export function getMixRadiusOwnerGroupService(): MixRadiusOwnerGroupService {
  if (!mixRadiusOwnerGroupServiceInstance) {
    mixRadiusOwnerGroupServiceInstance = new MixRadiusOwnerGroupService();
  }

  return mixRadiusOwnerGroupServiceInstance;
}
