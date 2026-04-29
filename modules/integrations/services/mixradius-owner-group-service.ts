import { mixRadiusOwnerGroupRepository } from "@/modules/integrations/repositories/MixRadiusOwnerGroupRepository";

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
  /**
   * Get owner groups for a tenant.
   */
  async getOwnerGroups(tenantId?: string) {
    return mixRadiusOwnerGroupRepository.findMany(tenantId);
  }

  /**
   * Get owner group by id.
   */
  async getOwnerGroup(id: string, tenantId?: string) {
    return mixRadiusOwnerGroupRepository.findById(id, tenantId);
  }

  /**
   * Create a new owner group.
   */
  async createOwnerGroup(data: MixRadiusOwnerGroupPayload) {
    return mixRadiusOwnerGroupRepository.create(data);
  }

  /**
   * Update an existing owner group.
   */
  async updateOwnerGroup(id: string, data: MixRadiusOwnerGroupUpdatePayload) {
    const { tenantId, ...updateData } = data;
    return mixRadiusOwnerGroupRepository.update(id, tenantId, updateData);
  }

  /**
   * Delete an owner group.
   */
  async deleteOwnerGroup(id: string, tenantId?: string) {
    return mixRadiusOwnerGroupRepository.delete(id, tenantId);
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
