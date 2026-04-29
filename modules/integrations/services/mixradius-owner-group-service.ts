import { mixRadiusOwnerGroupRepository } from "@/modules/integrations/repositories/MixRadiusOwnerGroupRepository";
import type { IMixRadiusOwnerGroupRepository } from "../domain/ports/IMixRadiusOwnerGroupRepository";

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
  constructor(
    private readonly repository: IMixRadiusOwnerGroupRepository = mixRadiusOwnerGroupRepository,
  ) {}

  /**
   * Get owner groups for a tenant.
   */
  async getOwnerGroups(tenantId?: string) {
    return this.repository.findMany(tenantId);
  }

  /**
   * Get owner group by id.
   */
  async getOwnerGroup(id: string, tenantId?: string) {
    return this.repository.findById(id, tenantId);
  }

  /**
   * Create a new owner group.
   */
  async createOwnerGroup(data: MixRadiusOwnerGroupPayload) {
    return this.repository.create(data);
  }

  /**
   * Update an existing owner group.
   */
  async updateOwnerGroup(id: string, data: MixRadiusOwnerGroupUpdatePayload) {
    const { tenantId, ...updateData } = data;
    return this.repository.update(id, tenantId, updateData);
  }

  /**
   * Delete an owner group.
   */
  async deleteOwnerGroup(id: string, tenantId?: string) {
    return this.repository.delete(id, tenantId);
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
