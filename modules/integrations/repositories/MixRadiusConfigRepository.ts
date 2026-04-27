import { prismaBilling } from "@/lib/prisma-billing";

import { IntegrationMapper } from "../mappers/IntegrationMapper";
import type {
  IMixRadiusConfigRepository,
  MixRadiusConfigCreateInput,
  MixRadiusConfigUpdateInput,
} from "../domain/ports/IMixRadiusConfigRepository";

type ConfigWhere = { id: string; tenantId?: string };

export class MixRadiusConfigRepository implements IMixRadiusConfigRepository {
  /** Get the active config across tenants. */
  async getActiveConfig() {
    return this.findActiveConfig();
  }

  /** Get the active config for a tenant. */
  async getActiveConfigByTenant(tenantId: string) {
    return this.findActiveConfig(tenantId);
  }

  /** Get all configs across tenants. */
  async getAllConfigs() {
    return this.findConfigs();
  }

  /** Get all configs for a tenant. */
  async getAllConfigsByTenant(tenantId: string) {
    return this.findConfigs(tenantId);
  }

  /** Get a config by id. */
  async getConfigById(id: string) {
    const model = await prismaBilling.mixRadiusConfig.findUnique({
      where: { id },
    });
    return model ? IntegrationMapper.toConfigDomain(model) : null;
  }

  /** Get a tenant config by id. */
  async getConfigByIdForTenant(id: string, tenantId: string) {
    const model = await prismaBilling.mixRadiusConfig.findFirst({
      where: { id, tenantId },
    });
    return model ? IntegrationMapper.toConfigDomain(model) : null;
  }

  /** Create a MixRadius config. */
  async createConfig(data: MixRadiusConfigCreateInput) {
    this.ensureTenantId(data.tenantId);

    if (data.isDefault) {
      await this.deactivateAllForTenant(data.tenantId);
    }

    const model = await prismaBilling.mixRadiusConfig.create({
      data: {
        ...data,
        name: data.name || "Default",
      },
    });

    return IntegrationMapper.toConfigDomain(model);
  }

  /** Update a config globally. */
  async updateConfig(id: string, data: MixRadiusConfigUpdateInput) {
    return this.updateConfigByWhere({ id }, data);
  }

  /** Update a config for a tenant. */
  async updateConfigForTenant(
    id: string,
    tenantId: string,
    data: MixRadiusConfigUpdateInput,
  ) {
    return this.updateConfigByWhere({ id, tenantId }, data);
  }

  /** Delete a config globally. */
  async deleteConfig(id: string) {
    const model = await prismaBilling.mixRadiusConfig.delete({ where: { id } });
    return IntegrationMapper.toConfigDomain(model);
  }

  /** Delete a config for a tenant. */
  async deleteConfigForTenant(id: string, tenantId: string) {
    const model = await prismaBilling.mixRadiusConfig.delete({
      where: { id, tenantId },
    });
    return IntegrationMapper.toConfigDomain(model);
  }

  /** Activate a config globally. */
  async setActive(id: string) {
    return this.activateConfig({ id });
  }

  /** Activate a config for a tenant. */
  async setActiveForTenant(id: string, tenantId: string) {
    return this.activateConfig({ id, tenantId });
  }

  /** Find the active config with optional tenant filter. */
  private async findActiveConfig(tenantId?: string) {
    const model = await prismaBilling.mixRadiusConfig.findFirst({
      where: { isDefault: true, ...(tenantId ? { tenantId } : {}) },
    });
    return model ? IntegrationMapper.toConfigDomain(model) : null;
  }

  /** Find configs with optional tenant filter. */
  private async findConfigs(tenantId?: string) {
    const models = await prismaBilling.mixRadiusConfig.findMany({
      ...(tenantId ? { where: { tenantId } } : {}),
      orderBy: { createdAt: "desc" },
    });
    return models.map((model) => IntegrationMapper.toConfigDomain(model));
  }

  /** Update a config using a scoped where clause. */
  private async updateConfigByWhere(
    where: ConfigWhere,
    data: MixRadiusConfigUpdateInput,
  ) {
    if (data.isDefault === true) {
      await this.deactivateDefaultSiblings(where);
    }

    const model = await prismaBilling.mixRadiusConfig.update({ where, data });
    return IntegrationMapper.toConfigDomain(model);
  }

  /** Activate a config and deactivate siblings. */
  private async activateConfig(where: ConfigWhere) {
    await this.deactivateDefaultSiblings(where);

    const model = await prismaBilling.mixRadiusConfig.update({
      where,
      data: { isDefault: true },
    });

    return IntegrationMapper.toConfigDomain(model);
  }

  /** Deactivate default sibling configs. */
  private async deactivateDefaultSiblings(where: ConfigWhere) {
    const tenantId =
      where.tenantId ?? (await this.findTenantIdByConfigId(where.id));

    if (!tenantId) {
      return;
    }

    await this.deactivateAllForTenant(tenantId, where.id);
  }

  /** Find the tenant id by config id. */
  private async findTenantIdByConfigId(id: string) {
    const existing = await prismaBilling.mixRadiusConfig.findUnique({
      where: { id },
      select: { tenantId: true },
    });

    return existing?.tenantId ?? null;
  }

  /** Deactivate all active configs in a tenant. */
  private async deactivateAllForTenant(tenantId: string, exceptId?: string) {
    await prismaBilling.mixRadiusConfig.updateMany({
      where: {
        ...(exceptId ? { id: { not: exceptId } } : {}),
        isDefault: true,
        tenantId,
      },
      data: { isDefault: false },
    });
  }

  /** Ensure tenant id exists before persistence. */
  private ensureTenantId(tenantId: string) {
    if (!tenantId) {
      throw new Error("Tenant MixRadius wajib disertakan");
    }
  }
}

export const mixRadiusConfigRepo = new MixRadiusConfigRepository();
