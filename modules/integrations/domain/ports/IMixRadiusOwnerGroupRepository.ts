import type { MixRadiusOwnerGroupEntity } from "../entities/MixRadiusOwnerGroupEntity";

export interface MixRadiusOwnerGroupPayload {
  name: string;
  owners: string[];
  siteId?: string;
  isActive?: boolean;
  tenantId?: string;
}

export interface MixRadiusOwnerGroupUpdatePayload {
  name?: string;
  owners?: string[];
  siteId?: string;
  isActive?: boolean;
  tenantId?: string;
}

export interface IMixRadiusOwnerGroupRepository {
  getOwnerGroups(tenantId?: string): Promise<MixRadiusOwnerGroupEntity[]>;
  getOwnerGroup(
    id: string,
    tenantId?: string,
  ): Promise<MixRadiusOwnerGroupEntity | null>;
  createOwnerGroup(
    data: MixRadiusOwnerGroupPayload,
  ): Promise<MixRadiusOwnerGroupEntity>;
  updateOwnerGroup(
    id: string,
    data: MixRadiusOwnerGroupUpdatePayload,
  ): Promise<MixRadiusOwnerGroupEntity>;
  deleteOwnerGroup(
    id: string,
    tenantId?: string,
  ): Promise<MixRadiusOwnerGroupEntity>;
}
