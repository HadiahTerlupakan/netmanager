import type { FeatureModuleCode } from "@/lib/feature-modules";

export interface TenantFeatureFlagRow {
  feature: string;
  enabled: boolean;
  updatedBy: string | null;
  updatedAt: Date;
}

export interface IFeatureFlagRepository {
  /** Ambil semua row flag untuk satu tenant. */
  findAllByTenant(tenantId: string): Promise<TenantFeatureFlagRow[]>;

  /** Ambil row spesifik (tenantId, feature). Null bila tidak ada. */
  findByFeature(
    tenantId: string,
    feature: FeatureModuleCode,
  ): Promise<TenantFeatureFlagRow | null>;

  /** Upsert satu row flag. */
  upsert(
    tenantId: string,
    feature: FeatureModuleCode,
    enabled: boolean,
    updatedBy: string | null,
  ): Promise<TenantFeatureFlagRow>;
}
