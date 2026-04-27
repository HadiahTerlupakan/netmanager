import type { MixRadiusConfigEntity } from "../entities/MixRadiusConfigEntity";

export type MixRadiusConfigCreateInput = Omit<
  MixRadiusConfigEntity,
  "id" | "createdAt" | "updatedAt"
>;

export type MixRadiusConfigUpdateInput = Partial<
  Omit<MixRadiusConfigEntity, "id" | "createdAt" | "updatedAt" | "tenantId">
>;

export interface IMixRadiusConfigRepository {
  getActiveConfig(): Promise<MixRadiusConfigEntity | null>;
  getActiveConfigByTenant(
    tenantId: string,
  ): Promise<MixRadiusConfigEntity | null>;
  getAllConfigs(): Promise<MixRadiusConfigEntity[]>;
  getAllConfigsByTenant(tenantId: string): Promise<MixRadiusConfigEntity[]>;
  getConfigById(id: string): Promise<MixRadiusConfigEntity | null>;
  getConfigByIdForTenant(
    id: string,
    tenantId: string,
  ): Promise<MixRadiusConfigEntity | null>;
  createConfig(
    data: MixRadiusConfigCreateInput,
  ): Promise<MixRadiusConfigEntity>;
  updateConfig(
    id: string,
    data: MixRadiusConfigUpdateInput,
  ): Promise<MixRadiusConfigEntity>;
  updateConfigForTenant(
    id: string,
    tenantId: string,
    data: MixRadiusConfigUpdateInput,
  ): Promise<MixRadiusConfigEntity>;
  deleteConfig(id: string): Promise<MixRadiusConfigEntity>;
  deleteConfigForTenant(
    id: string,
    tenantId: string,
  ): Promise<MixRadiusConfigEntity>;
  setActive(id: string): Promise<MixRadiusConfigEntity>;
  setActiveForTenant(
    id: string,
    tenantId: string,
  ): Promise<MixRadiusConfigEntity>;
}
