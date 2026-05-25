import type {
  CreateTaxRateConfigInput,
  TaxRateConfig,
  UpdateTaxRateConfigInput,
} from "../entities/TaxRateConfig";

export interface ITaxRateConfigRepository {
  listByTenant(tenantId: string): Promise<TaxRateConfig[]>;
  findById(id: string, tenantId: string): Promise<TaxRateConfig | null>;
  findByCode(tenantId: string, code: string): Promise<TaxRateConfig | null>;
  create(
    tenantId: string,
    input: CreateTaxRateConfigInput,
  ): Promise<TaxRateConfig>;
  update(
    id: string,
    tenantId: string,
    input: UpdateTaxRateConfigInput,
  ): Promise<TaxRateConfig>;
  delete(id: string, tenantId: string): Promise<void>;
}
