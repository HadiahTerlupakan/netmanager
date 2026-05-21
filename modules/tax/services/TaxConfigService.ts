import type { TaxConfig } from "../domain/entities/TaxConfig";
import { DEFAULT_TAX_CONFIG } from "../domain/entities/TaxConfig";
import type { ITaxConfigRepository } from "../domain/ports/ITaxConfigRepository";

export class TaxConfigService {
  constructor(private readonly configRepo: ITaxConfigRepository) {}

  /**
   * Get tax config for a tenant. Returns default values if not configured yet.
   */
  async getConfig(tenantId: string): Promise<TaxConfig> {
    const existing = await this.configRepo.findByTenantId(tenantId);
    if (existing) return existing;

    // Return virtual default (not persisted until explicit update)
    return {
      id: "",
      tenantId,
      ...DEFAULT_TAX_CONFIG,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Upsert tax config for a tenant.
   */
  async updateConfig(
    tenantId: string,
    data: Partial<
      Omit<TaxConfig, "id" | "tenantId" | "createdAt" | "updatedAt">
    >,
  ): Promise<TaxConfig> {
    return this.configRepo.upsert(tenantId, data);
  }
}
