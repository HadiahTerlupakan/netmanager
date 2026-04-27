import { prismaBilling } from "@/lib/prisma-billing";
import type { MixRadiusConfig } from "@prisma/client-billing";

type MixRadiusConfigCreateInput = Omit<
  MixRadiusConfig,
  "id" | "createdAt" | "updatedAt" | "tenantId"
> & {
  tenantId: string;
};

type MixRadiusConfigUpdateInput = Partial<
  Omit<MixRadiusConfig, "id" | "createdAt" | "updatedAt" | "tenantId">
>;

type ConfigWhere = { id: string; tenantId?: string };

export class MixRadiusConfigRepository {
  async getActiveConfig() {
    return this.findActiveConfig();
  }

  async getActiveConfigByTenant(tenantId: string) {
    return this.findActiveConfig(tenantId);
  }

  async getAllConfigs() {
    return this.findConfigs();
  }

  async getAllConfigsByTenant(tenantId: string) {
    return this.findConfigs(tenantId);
  }

  async getConfigById(id: string) {
    return prismaBilling.mixRadiusConfig.findUnique({
      where: { id },
    });
  }

  async getConfigByIdForTenant(id: string, tenantId: string) {
    return prismaBilling.mixRadiusConfig.findFirst({
      where: { id, tenantId },
    });
  }

  async createConfig(data: MixRadiusConfigCreateInput) {
    if (!data.tenantId) {
      throw new Error("Tenant MixRadius wajib disertakan");
    }

    if (data.isDefault) {
      await this.deactivateAllForTenant(data.tenantId);
    }

    return prismaBilling.mixRadiusConfig.create({
      data: {
        ...data,
        name: data.name || "Default",
      },
    });
  }

  async updateConfig(id: string, data: MixRadiusConfigUpdateInput) {
    return this.updateConfigByWhere({ id }, data);
  }

  async updateConfigForTenant(
    id: string,
    tenantId: string,
    data: MixRadiusConfigUpdateInput,
  ) {
    return this.updateConfigByWhere({ id, tenantId }, data);
  }

  async deleteConfig(id: string) {
    return prismaBilling.mixRadiusConfig.delete({
      where: { id },
    });
  }

  async deleteConfigForTenant(id: string, tenantId: string) {
    return prismaBilling.mixRadiusConfig.delete({
      where: { id, tenantId },
    });
  }

  async setActive(id: string) {
    return this.activateConfig({ id });
  }

  async setActiveForTenant(id: string, tenantId: string) {
    return this.activateConfig({ id, tenantId });
  }

  private findActiveConfig(tenantId?: string) {
    return prismaBilling.mixRadiusConfig.findFirst({
      where: { isDefault: true, ...(tenantId ? { tenantId } : {}) },
    });
  }

  private findConfigs(tenantId?: string) {
    return prismaBilling.mixRadiusConfig.findMany({
      ...(tenantId ? { where: { tenantId } } : {}),
      orderBy: { createdAt: "desc" },
    });
  }

  private async updateConfigByWhere(
    where: ConfigWhere,
    data: MixRadiusConfigUpdateInput,
  ) {
    if (data.isDefault === true) {
      await this.deactivateDefaultSiblings(where);
    }

    return prismaBilling.mixRadiusConfig.update({
      where,
      data,
    });
  }

  private async activateConfig(where: ConfigWhere) {
    await this.deactivateDefaultSiblings(where);

    return prismaBilling.mixRadiusConfig.update({
      where,
      data: { isDefault: true },
    });
  }

  private async deactivateDefaultSiblings(where: ConfigWhere) {
    const tenantId =
      where.tenantId ?? (await this.findTenantIdByConfigId(where.id));

    if (tenantId) {
      await this.deactivateAllForTenant(tenantId, where.id);
    }
  }

  private async findTenantIdByConfigId(id: string) {
    const existing = await prismaBilling.mixRadiusConfig.findUnique({
      where: { id },
      select: { tenantId: true },
    });

    return existing?.tenantId ?? null;
  }

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
}

export const mixRadiusConfigRepo = new MixRadiusConfigRepository();
