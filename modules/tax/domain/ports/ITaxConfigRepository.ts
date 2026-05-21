import type { TaxConfig } from "../entities/TaxConfig";

export interface ITaxConfigRepository {
  findByTenantId(tenantId: string): Promise<TaxConfig | null>;
  findAllTenantIds(): Promise<string[]>;
  upsert(
    tenantId: string,
    data: Partial<
      Omit<TaxConfig, "id" | "tenantId" | "createdAt" | "updatedAt">
    >,
  ): Promise<TaxConfig>;
}
