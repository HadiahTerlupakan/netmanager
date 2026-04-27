import type {
  IMixRadiusOwnerGroupRepository,
  MixRadiusOwnerGroupPayload,
  MixRadiusOwnerGroupUpdatePayload,
} from "../domain/ports/IMixRadiusOwnerGroupRepository";
import { MixRadiusOwnerGroupRepository } from "../repositories/MixRadiusOwnerGroupRepository";

export type { MixRadiusOwnerGroupPayload, MixRadiusOwnerGroupUpdatePayload };

export class MixRadiusOwnerGroupService {
  constructor(
    private readonly ownerGroupRepository: IMixRadiusOwnerGroupRepository = new MixRadiusOwnerGroupRepository(),
  ) {}

  /** Get owner groups with optional tenant filter. */
  async getOwnerGroups(tenantId?: string) {
    return this.ownerGroupRepository.getOwnerGroups(tenantId);
  }

  /** Get a single owner group. */
  async getOwnerGroup(id: string, tenantId?: string) {
    return this.ownerGroupRepository.getOwnerGroup(id, tenantId);
  }

  /** Create a new owner group. */
  async createOwnerGroup(data: MixRadiusOwnerGroupPayload) {
    return this.ownerGroupRepository.createOwnerGroup(data);
  }

  /** Update an owner group. */
  async updateOwnerGroup(id: string, data: MixRadiusOwnerGroupUpdatePayload) {
    return this.ownerGroupRepository.updateOwnerGroup(id, data);
  }

  /** Delete an owner group. */
  async deleteOwnerGroup(id: string, tenantId?: string) {
    return this.ownerGroupRepository.deleteOwnerGroup(id, tenantId);
  }
}

let mixRadiusOwnerGroupServiceInstance: MixRadiusOwnerGroupService | null =
  null;

/** Get the shared owner group service instance. */
export function getMixRadiusOwnerGroupService(): MixRadiusOwnerGroupService {
  if (!mixRadiusOwnerGroupServiceInstance) {
    mixRadiusOwnerGroupServiceInstance = new MixRadiusOwnerGroupService();
  }

  return mixRadiusOwnerGroupServiceInstance;
}
