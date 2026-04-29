import type { MixRadiusOwnerGroupEntity } from "../domain/entities/MixRadiusOwnerGroupEntity";
import {
  getMixRadiusOwnerGroupService,
  type MixRadiusOwnerGroupPayload,
  type MixRadiusOwnerGroupUpdatePayload,
} from "./mixradius-owner-group-service";

export type MixRadiusOwnerGroup = MixRadiusOwnerGroupEntity;

export class MixRadiusOwnerGroupFacadeService {
  /** Get owner groups for a tenant. */
  async getOwnerGroups(tenantId?: string) {
    return getMixRadiusOwnerGroupService().getOwnerGroups(tenantId);
  }

  /** Get owner group by id. */
  async getOwnerGroup(id: string, tenantId?: string) {
    return getMixRadiusOwnerGroupService().getOwnerGroup(id, tenantId);
  }

  /** Create a new owner group. */
  async createOwnerGroup(data: MixRadiusOwnerGroupPayload) {
    return getMixRadiusOwnerGroupService().createOwnerGroup(data);
  }

  /** Update an existing owner group. */
  async updateOwnerGroup(id: string, data: MixRadiusOwnerGroupUpdatePayload) {
    return getMixRadiusOwnerGroupService().updateOwnerGroup(id, data);
  }

  /** Delete an owner group. */
  async deleteOwnerGroup(id: string, tenantId?: string) {
    return getMixRadiusOwnerGroupService().deleteOwnerGroup(id, tenantId);
  }
}
