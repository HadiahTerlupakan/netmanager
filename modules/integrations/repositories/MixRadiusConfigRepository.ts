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

export class MixRadiusConfigRepository {
  async getActiveConfig() {
    return prismaBilling.mixRadiusConfig.findFirst({
      where: { isDefault: true },
    });
  }

  async getActiveConfigByTenant(tenantId: string) {
    return prismaBilling.mixRadiusConfig.findFirst({
      where: { isDefault: true, tenantId },
    });
  }

  async getAllConfigs() {
    return prismaBilling.mixRadiusConfig.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  async getAllConfigsByTenant(tenantId: string) {
    return prismaBilling.mixRadiusConfig.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
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
    if (data.isDefault === true) {
      const existing = await prismaBilling.mixRadiusConfig.findUnique({
        where: { id },
        select: { tenantId: true },
      });

      if (existing?.tenantId) {
        await this.deactivateAllForTenant(existing.tenantId, id);
      }
    }

    return prismaBilling.mixRadiusConfig.update({
      where: { id },
      data,
    });
  }

  async updateConfigForTenant(
    id: string,
    tenantId: string,
    data: MixRadiusConfigUpdateInput,
  ) {
    if (data.isDefault === true) {
      await this.deactivateAllForTenant(tenantId, id);
    }

    return prismaBilling.mixRadiusConfig.update({
      where: { id, tenantId },
      data,
    });
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
    const existing = await prismaBilling.mixRadiusConfig.findUnique({
      where: { id },
      select: { tenantId: true },
    });

    if (existing?.tenantId) {
      await this.deactivateAllForTenant(existing.tenantId, id);
    }

    return prismaBilling.mixRadiusConfig.update({
      where: { id },
      data: { isDefault: true },
    });
  }

  async setActiveForTenant(id: string, tenantId: string) {
    await this.deactivateAllForTenant(tenantId, id);
    return prismaBilling.mixRadiusConfig.update({
      where: { id, tenantId },
      data: { isDefault: true },
    });
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
