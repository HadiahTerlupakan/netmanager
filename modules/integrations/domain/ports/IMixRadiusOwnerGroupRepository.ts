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
  findMany(tenantId?: string): Promise<MixRadiusOwnerGroupEntity[]>;
  findById(
    id: string,
    tenantId?: string,
  ): Promise<MixRadiusOwnerGroupEntity | null>;
  create(data: MixRadiusOwnerGroupPayload): Promise<MixRadiusOwnerGroupEntity>;
  update(
    id: string,
    tenantId: string | undefined,
    data: Omit<MixRadiusOwnerGroupUpdatePayload, "tenantId">,
  ): Promise<MixRadiusOwnerGroupEntity>;
  delete(id: string, tenantId?: string): Promise<MixRadiusOwnerGroupEntity>;
  findOwnersBySiteId(siteId: string): Promise<string[]>;
  findOwnersByGroupId(groupId: string): Promise<string[] | null>;
}
