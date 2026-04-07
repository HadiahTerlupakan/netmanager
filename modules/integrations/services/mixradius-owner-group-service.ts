import { prismaBilling } from "@/lib/prisma-billing";

export type MixRadiusOwnerGroupPayload = {
  name: string;
  owners: string[];
  siteId?: string;
  isActive?: boolean;
};

export type MixRadiusOwnerGroupUpdatePayload = {
  name?: string;
  owners?: string[];
  siteId?: string;
  isActive?: boolean;
};

export class MixRadiusOwnerGroupService {
  async getOwnerGroups() {
    return prismaBilling.mixRadiusOwnerGroup.findMany({
      orderBy: { name: "asc" },
    });
  }

  async getOwnerGroup(id: string) {
    return prismaBilling.mixRadiusOwnerGroup.findUnique({
      where: { id },
    });
  }

  async createOwnerGroup(data: MixRadiusOwnerGroupPayload) {
    return prismaBilling.mixRadiusOwnerGroup.create({
      data,
    });
  }

  async updateOwnerGroup(id: string, data: MixRadiusOwnerGroupUpdatePayload) {
    return prismaBilling.mixRadiusOwnerGroup.update({
      where: { id },
      data,
    });
  }

  async deleteOwnerGroup(id: string) {
    return prismaBilling.mixRadiusOwnerGroup.delete({
      where: { id },
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
